// RBAC guard (SDD 6.3): every service call resolves the caller's membership here.
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceMembers } from '@/db/schema';
import type { Actor } from '@/lib/auth';
import { atLeast, effectiveRole, type Role } from '@/lib/domain';
import { forbidden, notFound } from '@/lib/errors';

export type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const REQUIRED: Record<Role, string> = { Admin: 'Admin', Editor: 'Admin atau Editor', Viewer: 'anggota workspace' };

export async function requireMember(actor: Actor, workspaceId: string, min: Role = 'Viewer') {
  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, actor.id)))
    .limit(1);
  // Non-members get 404 so workspace IDs cannot be probed
  if (!membership) throw notFound('Workspace');

  const effective = effectiveRole(membership.role, actor.rolePreview);
  if (!atLeast(effective, min)) {
    throw forbidden(`Aksi ini memerlukan peran ${REQUIRED[min]}. Peran Anda saat ini: ${effective}.`);
  }
  return { role: membership.role, effective };
}

export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
