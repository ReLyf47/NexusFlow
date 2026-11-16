'use server';

// Server Actions = the web client's controller layer. Each one validates input with Zod,
// delegates to a service (which enforces RBAC) and returns an ActionResult envelope.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { clearSessionCookies, requireActor, ROLE_PREVIEW_COOKIE, setSessionCookies } from '@/lib/auth';
import { effectiveRole, isRole, type ActionResult, type Role } from '@/lib/domain';
import { toErrorBody } from '@/lib/errors';
import * as v from '@/lib/validations';
import * as aiService from '@/services/ai';
import * as authService from '@/services/auth';
import * as docService from '@/services/documents';
import { searchWorkspace } from '@/services/search';
import * as taskService from '@/services/tasks';
import * as wsService from '@/services/workspaces';
import { requireMember } from '@/services/access';

async function act<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: toErrorBody(e) };
  }
}

const uuid = z.string().uuid('ID tidak valid');
const ids = <K extends string>(...keys: K[]) =>
  z.object(Object.fromEntries(keys.map((k) => [k, uuid])) as Record<K, typeof uuid>);

// Only same-origin relative paths, to prevent open redirects via ?next=
const safeNext = (next: FormDataEntryValue | null) =>
  typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';

// ---------- Auth ----------

export async function loginAction(_prev: unknown, form: FormData) {
  const res = await act(async () => {
    const input = v.loginSchema.parse({ email: form.get('email'), password: form.get('password') });
    await setSessionCookies(await authService.login(input));
  });
  if (!res.ok) return res;
  redirect(safeNext(form.get('next')));
}

export async function registerAction(_prev: unknown, form: FormData) {
  const res = await act(async () => {
    const input = v.registerSchema.parse({
      name: form.get('name'),
      email: form.get('email'),
      password: form.get('password'),
    });
    const session = await authService.register(input);
    await setSessionCookies(session);
    return session.workspace.slug;
  });
  if (!res.ok) return res;
  redirect(`/w/${res.data}`);
}

export async function logoutAction() {
  await act(async () => authService.logout(await requireActor()));
  await clearSessionCookies();
  redirect('/login');
}

// Downgrade-only role preview (navbar role selector). Returns the new effective role.
export async function setRolePreviewAction(raw: { workspaceId: string; role: Role | null }) {
  return act(async () => {
    const { workspaceId } = ids('workspaceId').parse(raw);
    const role = raw.role === null ? null : isRole(raw.role) ? raw.role : null;
    const actor = await requireActor();
    const jar = await cookies();
    if (role) jar.set(ROLE_PREVIEW_COOKIE, role, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
    else jar.delete(ROLE_PREVIEW_COOKIE);
    const { role: actual } = await requireMember({ ...actor, rolePreview: null }, workspaceId);
    return { role: actual, effectiveRole: effectiveRole(actual, role) };
  });
}

// ---------- Workspace ----------

export async function getWorkspaceDataAction(raw: { workspaceId: string; documentId?: string | null }) {
  return act(async () => {
    const { workspaceId } = ids('workspaceId').parse(raw);
    return wsService.getSnapshot(await requireActor(), workspaceId, raw.documentId);
  });
}

export async function createWorkspaceAction(raw: unknown) {
  return act(async () => wsService.createWorkspace(await requireActor(), v.workspaceNameSchema.parse(raw).name));
}

export async function renameWorkspaceAction(raw: { workspaceId: string; name: string }) {
  return act(async () => {
    const { workspaceId } = ids('workspaceId').parse(raw);
    return wsService.renameWorkspace(await requireActor(), workspaceId, v.workspaceNameSchema.parse(raw).name);
  });
}

export async function deleteWorkspaceAction(raw: { workspaceId: string }) {
  return act(async () => wsService.deleteWorkspace(await requireActor(), ids('workspaceId').parse(raw).workspaceId));
}

export async function inviteMemberAction(raw: { workspaceId: string; email: string; role: Role }) {
  return act(async () => {
    const { workspaceId } = ids('workspaceId').parse(raw);
    return wsService.inviteMember(await requireActor(), workspaceId, v.inviteMemberSchema.parse(raw));
  });
}

export async function updateMemberRoleAction(raw: { workspaceId: string; memberId: string; role: Role }) {
  return act(async () => {
    const { workspaceId, memberId } = ids('workspaceId', 'memberId').parse(raw);
    return wsService.updateMemberRole(await requireActor(), workspaceId, memberId, v.memberRoleSchema.parse(raw).role);
  });
}

export async function removeMemberAction(raw: { workspaceId: string; memberId: string }) {
  return act(async () => {
    const { workspaceId, memberId } = ids('workspaceId', 'memberId').parse(raw);
    return wsService.removeMember(await requireActor(), workspaceId, memberId);
  });
}

export async function updateLlmSettingsAction(raw: { workspaceId: string } & z.input<typeof v.llmSettingsSchema>) {
  return act(async () => {
    const { workspaceId } = ids('workspaceId').parse(raw);
    return wsService.updateLlmSettings(await requireActor(), workspaceId, v.llmSettingsSchema.parse(raw));
  });
}

export async function renameProjectAction(raw: { workspaceId: string; from: string; to: string }) {
  return act(async () => {
    const { workspaceId } = ids('workspaceId').parse(raw);
    const { from, to } = v.projectRenameSchema.parse(raw);
    return wsService.renameProject(await requireActor(), workspaceId, from, to);
  });
}

// ---------- Documents ----------

export async function getDocumentAction(raw: { documentId: string }) {
  return act(async () => docService.getDocument(await requireActor(), ids('documentId').parse(raw).documentId));
}

export async function createDocumentAction(raw: z.input<typeof v.createDocumentSchema>) {
  return act(async () => docService.createDocument(await requireActor(), v.createDocumentSchema.parse(raw)));
}

export async function updateDocumentAction(raw: { documentId: string } & z.input<typeof v.updateDocumentSchema>) {
  return act(async () => {
    const { documentId } = ids('documentId').parse(raw);
    return docService.updateDocument(await requireActor(), documentId, v.updateDocumentSchema.parse(raw));
  });
}

export async function deleteDocumentAction(raw: { documentId: string; hard?: boolean }) {
  return act(async () =>
    docService.deleteDocument(await requireActor(), ids('documentId').parse(raw).documentId, raw.hard === true)
  );
}

// ---------- Tasks ----------

export async function createTaskAction(raw: z.input<typeof v.createTaskSchema>) {
  return act(async () => {
    const { workspaceId, ...input } = v.createTaskSchema.parse(raw);
    return taskService.createTask(await requireActor(), workspaceId, input);
  });
}

export async function updateTaskAction(raw: { taskId: string } & z.input<typeof v.updateTaskSchema>) {
  return act(async () => {
    const { taskId } = ids('taskId').parse(raw);
    return taskService.updateTask(await requireActor(), taskId, v.updateTaskSchema.parse(raw));
  });
}

export async function updateTaskStatusAction(raw: z.input<typeof v.updateTaskStatusSchema>) {
  return act(async () => {
    const { taskId, status } = v.updateTaskStatusSchema.parse(raw);
    return taskService.updateTaskStatus(await requireActor(), taskId, status);
  });
}

export async function deleteTaskAction(raw: { taskId: string }) {
  return act(async () => taskService.deleteTask(await requireActor(), ids('taskId').parse(raw).taskId));
}

export async function commitExtractedTasksAction(raw: z.input<typeof v.commitTasksSchema>) {
  return act(async () => taskService.createTasksBatch(await requireActor(), v.commitTasksSchema.parse(raw)));
}

// ---------- AI ----------

export async function summarizeDocumentAction(raw: z.input<typeof v.summarizeSchema>) {
  return act(async () => aiService.summarizeDocument(await requireActor(), v.summarizeSchema.parse(raw)));
}

export async function extractActionItemsAction(raw: z.input<typeof v.extractSchema>) {
  return act(async () => aiService.extractDocumentActions(await requireActor(), v.extractSchema.parse(raw).documentId));
}

export async function aiStatusAction(raw: { workspaceId: string }) {
  return act(async () => aiService.aiStatus(await requireActor(), ids('workspaceId').parse(raw).workspaceId));
}

// ---------- Search ----------

export async function searchWorkspaceAction(raw: z.input<typeof v.searchQuerySchema>) {
  return act(async () => searchWorkspace(await requireActor(), v.searchQuerySchema.parse(raw)));
}
