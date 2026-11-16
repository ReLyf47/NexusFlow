// Process 1.0 — Registration, login, token refresh & revocation
import { eq, sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { db } from '@/db';
import { users } from '@/db/schema';
import {
  assertLoginAllowed,
  hashPassword,
  issueTokens,
  recordLoginResult,
  verifyPassword,
  type Actor,
} from '@/lib/auth';
import type { UserDTO } from '@/lib/domain';
import { AppError } from '@/lib/errors';
import { verifyToken } from '@/lib/tokens';
import { createWorkspaceRecord } from './workspaces';

const toUser = (u: { id: string; name: string; email: string; avatarUrl: string | null }): UserDTO => ({
  id: u.id,
  name: u.name,
  email: u.email,
  avatarUrl: u.avatarUrl,
});

// Compared against when the email is unknown, so timing does not reveal registered emails
let dummyHash: Promise<string> | undefined;

export async function register(input: { name: string; email: string; password: string }) {
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (taken) throw new AppError(409, 'EMAIL_TAKEN', 'Email sudah terdaftar. Silakan login.');
  const user = {
    id: randomUUID(),
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    tokenVersion: 0,
  };
  // Every account starts with a personal workspace it administers
  const workspace = await db.transaction(async (tx) => {
    await tx.insert(users).values(user);
    return createWorkspaceRecord(tx, user.id, `Workspace ${input.name.split(' ')[0]}`);
  });
  return { ...(await issueTokens(user)), user: toUser({ ...user, avatarUrl: null }), workspace };
}

export async function login(input: { email: string; password: string }) {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const key = `${ip}|${input.email}`;
  assertLoginAllowed(key);
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  const ok = await verifyPassword(input.password, user?.passwordHash ?? (await (dummyHash ??= hashPassword(randomUUID()))));
  recordLoginResult(key, ok && !!user);
  if (!user || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email atau password salah.');
  return { ...(await issueTokens(user)), user: toUser(user) };
}

export async function refreshSession(refreshToken: string | undefined) {
  const payload = await verifyToken(refreshToken, 'refresh');
  const [user] = payload ? await db.select().from(users).where(eq(users.id, payload.sub)).limit(1) : [];
  if (!payload || !user || user.tokenVersion !== payload.ver) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Refresh token tidak valid atau sudah dicabut. Silakan login kembali.');
  }
  return { ...(await issueTokens(user)), user: toUser(user) };
}

// Revokes every access & refresh token of this user on all devices
export async function logout(actor: Actor) {
  await db
    .update(users)
    .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, actor.id));
}
