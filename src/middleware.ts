// Silent session refresh: a valid 7-day refresh cookie mints a new 2-hour access cookie.
// Revocation (tokenVersion) is still enforced server-side by getActor().
import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, ACCESS_TTL, REFRESH_COOKIE, cookieOptions, signToken, verifyToken } from '@/lib/tokens';

const PUBLIC_PAGES = new Set(['/login', '/register']);

// The mobile app (incl. its web build) calls /api/* with Bearer tokens from another origin.
// A wildcard origin never carries cookies (no credentials mode), so cookie sessions stay CSRF-safe.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,content-type',
  'Access-Control-Max-Age': '86400',
};

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith('/api/')) {
    if (req.method === 'OPTIONS') return new NextResponse(null, { status: 204, headers: CORS });
    const res = await refreshSession(req);
    for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
    return res;
  }

  if (await verifyToken(req.cookies.get(ACCESS_COOKIE)?.value, 'access')) return NextResponse.next();
  const refreshed = await refreshSession(req);
  if (refreshed.cookies.get(ACCESS_COOKIE)) return refreshed;

  // Server Actions answer 401 themselves instead of being redirected
  if (PUBLIC_PAGES.has(pathname) || req.headers.has('next-action')) return NextResponse.next();
  const login = new URL('/login', req.url);
  if (pathname !== '/') login.searchParams.set('next', pathname + search);
  return NextResponse.redirect(login);
}

async function refreshSession(req: NextRequest) {
  if (await verifyToken(req.cookies.get(ACCESS_COOKIE)?.value, 'access')) return NextResponse.next();
  const refresh = await verifyToken(req.cookies.get(REFRESH_COOKIE)?.value, 'refresh');
  if (!refresh) return NextResponse.next();
  const token = await signToken(refresh.sub, refresh.ver, 'access');
  req.cookies.set(ACCESS_COOKIE, token); // forward to this request's server code
  const res = NextResponse.next({ request: { headers: req.headers } });
  res.cookies.set(ACCESS_COOKIE, token, cookieOptions(ACCESS_TTL));
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:png|svg|ico|jpg|webp|txt)$).*)'],
};
