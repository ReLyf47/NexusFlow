// Server-side session primitives. Tokens may arrive as httpOnly cookies (web)
// or as `Authorization: Bearer` headers (REST / mobile app).
import { cookies, headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { AppError } from './errors';
import { isRole, type Role, type UserDTO } from './domain';
import { ACCESS_COOKIE, ACCESS_TTL, REFRESH_COOKIE, REFRESH_TTL, cookieOptions, signToken, verifyToken } from './tokens';

export { hashPassword, verifyPassword } from './password';

export const ROLE_PREVIEW_COOKIE = 'nf_role_preview';

export interface Actor extends UserDTO {
  tokenVersion: number;
  rolePreview: Role | null;
}

export async function getActor(): Promise<Actor | null> {
  const [h, jar] = await Promise.all([headers(), cookies()]);
  const bearer = h.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const payload = await verifyToken(bearer ?? jar.get(ACCESS_COOKIE)?.value, 'access');
  if (!payload) return null;

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      tokenVersion: users.tokenVersion,
    })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);
  if (!user || user.tokenVersion !== payload.ver) return null;

  // Role preview is a web-only lens; API clients always act with their real role
  const preview = bearer ? null : jar.get(ROLE_PREVIEW_COOKIE)?.value;
  return { ...user, rolePreview: isRole(preview) ? preview : null };
}

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new AppError(401, 'UNAUTHENTICATED', 'Sesi berakhir, silakan login kembali.');
  return actor;
}

export async function issueTokens(user: { id: string; tokenVersion: number }) {
  const [token, refreshToken] = await Promise.all([
    signToken(user.id, user.tokenVersion, 'access'),
    signToken(user.id, user.tokenVersion, 'refresh'),
  ]);
  return { token, refreshToken, expiresIn: ACCESS_TTL };
}

export async function setSessionCookies(tokens: { token: string; refreshToken: string }) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, tokens.token, cookieOptions(ACCESS_TTL));
  jar.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(REFRESH_TTL));
}

export async function clearSessionCookies() {
  const jar = await cookies();
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, ROLE_PREVIEW_COOKIE]) jar.delete(name);
}

// shortcut: in-memory and per-process, resets on restart; move to Redis/DB when running multiple instances
const failedLogins = new Map<string, { count: number; until: number }>();
const MAX_FAILURES = 10;
const LOCK_MS = 15 * 60 * 1000;

export function assertLoginAllowed(key: string) {
  const entry = failedLogins.get(key);
  if (entry && entry.count >= MAX_FAILURES && entry.until > Date.now()) {
    throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.');
  }
}

export function recordLoginResult(key: string, success: boolean) {
  if (success) return void failedLogins.delete(key);
  const entry = failedLogins.get(key);
  const count = entry && entry.until > Date.now() ? entry.count + 1 : 1;
  failedLogins.set(key, { count, until: Date.now() + LOCK_MS });
}
