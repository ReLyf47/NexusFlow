// Process 2.0 — Workspace, members (RBAC), LLM configuration & projects
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { documents, tags, users, workspaceMembers, workspaces } from '@/db/schema';
import { resolveLlmConfig } from '@/lib/ai';
import type { Actor } from '@/lib/auth';
import { encryptSecret } from '@/lib/crypto';
import type { LlmInfoDTO, LlmProvider, MemberDTO, Role, WorkspaceRefDTO, WorkspaceSnapshotDTO } from '@/lib/domain';
import { AppError, forbidden, notFound } from '@/lib/errors';
import { requireMember, type Executor } from './access';
import { docSummaryColumns, getDocument, tagsByDocument, toDocSummary } from './documents';
import { listWorkspaceTasks } from './tasks';

const slugify = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

export async function createWorkspaceRecord(ex: Executor, ownerId: string, name: string): Promise<WorkspaceRefDTO> {
  const id = randomUUID();
  const slug = `${slugify(name) || 'workspace'}-${randomUUID().slice(0, 6)}`;
  await ex.insert(workspaces).values({ id, name, slug, ownerId });
  await ex.insert(workspaceMembers).values({ id: randomUUID(), workspaceId: id, userId: ownerId, role: 'Admin' });
  return { id, name, slug, role: 'Admin' };
}

export async function listMyWorkspaces(actor: Actor): Promise<WorkspaceRefDTO[]> {
  return db
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, actor.id))
    .orderBy(asc(workspaceMembers.joinedAt));
}

export const createWorkspace = (actor: Actor, name: string) => db.transaction((tx) => createWorkspaceRecord(tx, actor.id, name));

export async function workspaceIdBySlug(actor: Actor, slug: string) {
  const [ws] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
  if (!ws) throw notFound('Workspace');
  await requireMember(actor, ws.id);
  return ws.id;
}

async function loadWorkspace(workspaceId: string) {
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  if (!ws) throw notFound('Workspace');
  return ws;
}

function llmInfo(
  ws: { llmProvider: LlmProvider; llmBaseUrl: string | null; llmModel: string | null; llmApiKey: string | null },
  isAdmin: boolean
): LlmInfoDTO {
  const cfg = resolveLlmConfig(ws, null);
  // baseUrl is the stored override (empty = env/provider default), so saving the form never pins a default
  return { provider: cfg.provider, model: cfg.model, baseUrl: isAdmin ? ws.llmBaseUrl : null, hasApiKey: !!ws.llmApiKey };
}

export async function renameWorkspace(actor: Actor, workspaceId: string, name: string) {
  await requireMember(actor, workspaceId, 'Admin');
  await db.update(workspaces).set({ name }).where(eq(workspaces.id, workspaceId));
  return { id: workspaceId, name };
}

export async function deleteWorkspace(actor: Actor, workspaceId: string) {
  await requireMember(actor, workspaceId, 'Admin');
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  return { id: workspaceId };
}

// ---------- Members & roles (FR-AUTH-04, UC-01) ----------

async function membersOf(workspaceId: string): Promise<MemberDTO[]> {
  const rows = await db
    .select({
      id: workspaceMembers.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(workspaceMembers.joinedAt));
  return rows.map((r) => ({ ...r, joinedAt: r.joinedAt.toISOString() }));
}

export async function listMembers(actor: Actor, workspaceId: string) {
  await requireMember(actor, workspaceId);
  return membersOf(workspaceId);
}

export async function inviteMember(actor: Actor, workspaceId: string, input: { email: string; role: Role }) {
  await requireMember(actor, workspaceId, 'Admin');
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Belum ada akun dengan email tersebut. Minta pengguna registrasi terlebih dahulu.');
  }
  try {
    await db.insert(workspaceMembers).values({ id: randomUUID(), workspaceId, userId: user.id, role: input.role });
  } catch (e) {
    if ((e as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'ALREADY_MEMBER', 'Pengguna sudah menjadi anggota workspace ini.');
    }
    throw e;
  }
  return (await membersOf(workspaceId)).find((m) => m.userId === user.id)!;
}

async function loadMember(workspaceId: string, memberId: string) {
  const [member] = await db
    .select({ id: workspaceMembers.id, userId: workspaceMembers.userId, ownerId: workspaces.ownerId })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1);
  if (!member) throw notFound('Anggota');
  return member;
}

export async function updateMemberRole(actor: Actor, workspaceId: string, memberId: string, role: Role) {
  await requireMember(actor, workspaceId, 'Admin');
  const member = await loadMember(workspaceId, memberId);
  if (member.userId === member.ownerId && role !== 'Admin') throw forbidden('Pemilik workspace harus tetap berperan Admin.');
  await db.update(workspaceMembers).set({ role }).where(eq(workspaceMembers.id, memberId));
  return (await membersOf(workspaceId)).find((m) => m.id === memberId)!;
}

export async function removeMember(actor: Actor, workspaceId: string, memberId: string) {
  await requireMember(actor, workspaceId, 'Admin');
  const member = await loadMember(workspaceId, memberId);
  if (member.userId === member.ownerId) throw forbidden('Pemilik workspace tidak dapat dikeluarkan.');
  await db.delete(workspaceMembers).where(eq(workspaceMembers.id, memberId));
  return { id: memberId };
}

// ---------- LLM configuration (FR-AI-03, UC-02) ----------

export async function getLlmSettings(actor: Actor, workspaceId: string) {
  await requireMember(actor, workspaceId, 'Admin');
  return llmInfo(await loadWorkspace(workspaceId), true);
}

export async function updateLlmSettings(
  actor: Actor,
  workspaceId: string,
  input: { provider: LlmProvider; baseUrl?: string; model?: string; apiKey?: string }
) {
  await requireMember(actor, workspaceId, 'Admin');
  await db
    .update(workspaces)
    .set({
      llmProvider: input.provider,
      llmBaseUrl: input.baseUrl || null,
      llmModel: input.model || null,
      ...(input.apiKey !== undefined && { llmApiKey: input.apiKey ? encryptSecret(input.apiKey) : null }),
    })
    .where(eq(workspaces.id, workspaceId));
  return llmInfo(await loadWorkspace(workspaceId), true);
}

// ---------- Projects (UC-03): documents.project_name is the project key ----------

export async function renameProject(actor: Actor, workspaceId: string, from: string, to: string) {
  await requireMember(actor, workspaceId, 'Admin');
  const [res] = await db
    .update(documents)
    .set({ projectName: to })
    .where(and(eq(documents.workspaceId, workspaceId), eq(documents.projectName, from)));
  return { from, to, moved: res.affectedRows };
}

// ---------- Snapshot (spec: getWorkspaceDataAction) ----------

export async function getSnapshot(actor: Actor, workspaceId: string, activeDocId?: string | null): Promise<WorkspaceSnapshotDTO> {
  const { role, effective } = await requireMember(actor, workspaceId);
  const [ws, members, docRows, tagMap, tagRows, taskList, myWorkspaces] = await Promise.all([
    loadWorkspace(workspaceId),
    membersOf(workspaceId),
    db.select(docSummaryColumns).from(documents).where(eq(documents.workspaceId, workspaceId)).orderBy(desc(documents.updatedAt)),
    tagsByDocument(workspaceId),
    db.select({ id: tags.id, name: tags.name, color: tags.color }).from(tags).where(eq(tags.workspaceId, workspaceId)).orderBy(asc(tags.name)),
    listWorkspaceTasks(workspaceId),
    listMyWorkspaces(actor),
  ]);

  const docs = docRows.map((r) => toDocSummary(r, tagMap.get(r.id) ?? []));
  const activeId = docs.find((d) => d.id === activeDocId)?.id ?? docs.find((d) => !d.isArchived)?.id;
  const active = activeId ? await getDocument(actor, activeId) : null;

  return {
    workspace: { id: ws.id, name: ws.name, slug: ws.slug, ownerId: ws.ownerId, llm: llmInfo(ws, role === 'Admin') },
    me: { id: actor.id, name: actor.name, email: actor.email, avatarUrl: actor.avatarUrl },
    role,
    effectiveRole: effective,
    workspaces: myWorkspaces,
    members,
    documents: docs,
    tags: tagRows,
    tasks: taskList,
    activeDoc: active?.document ?? null,
    context: active?.context ?? null,
  };
}
