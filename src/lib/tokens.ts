// JWT helpers. Edge-safe (used by middleware): no Node or DB imports here.
import { SignJWT, jwtVerify } from 'jose';

export const ACCESS_COOKIE = 'nf_access';
export const REFRESH_COOKIE = 'nf_refresh';
export const ACCESS_TTL = 60 * 60 * 2; // 2 hours (NFR-SEC-03)
export const REFRESH_TTL = 60 * 60 * 24 * 7; // 7 days

export type TokenType = 'access' | 'refresh';
export interface TokenPayload {
  sub: string;
  ver: number;
}

let warned = false;
function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (secret) return new TextEncoder().encode(secret);
  if (process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET wajib diisi di production.');
  if (!warned) {
    console.warn('[nexusflow] AUTH_SECRET kosong — memakai secret development. Jangan dipakai di production.');
    warned = true;
  }
  return new TextEncoder().encode('nexusflow-dev-only-secret-change-me');
}

export function signToken(userId: string, ver: number, typ: TokenType) {
  return new SignJWT({ ver, typ })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + (typ === 'access' ? ACCESS_TTL : REFRESH_TTL))
    .sign(secretKey());
}

export async function verifyToken(token: string | undefined | null, typ: TokenType): Promise<TokenPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (payload.typ !== typ || typeof payload.sub !== 'string' || typeof payload.ver !== 'number') return null;
    return { sub: payload.sub, ver: payload.ver };
  } catch {
    return null;
  }
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  // NFR-SEC-02: production is served over HTTPS
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
});
