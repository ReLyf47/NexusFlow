// Process 4.0 — Task & Kanban management
import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { documents, tasks, users, workspaceMembers } from '@/db/schema';
import type { Actor } from '@/lib/auth';
import type { TaskDTO, TaskPriority, TaskStatus } from '@/lib/domain';
import { badRequest, notFound } from '@/lib/errors';
import { requireMember } from './access';

const taskColumns = {
  id: tasks.id,
  workspaceId: tasks.workspaceId,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  priority: tasks.priority,
  dueDate: tasks.dueDate,
  documentId: tasks.documentId,
  assigneeId: tasks.assigneeId,
  assigneeName: users.name,
  extractedByAi: tasks.extractedByAi,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
};

type TaskRow = Omit<TaskDTO, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date };

const toTaskDTO = (r: TaskRow): TaskDTO => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

const selectTasks = () => db.select(taskColumns).from(tasks).leftJoin(users, eq(users.id, tasks.assigneeId));

export interface TaskFilters {
  status?: TaskStatus;
  assigneeId?: string;
  project?: string;
}

export async function listWorkspaceTasks(workspaceId: string, filters: TaskFilters = {}): Promise<TaskDTO[]> {
  const conds = [eq(tasks.workspaceId, workspaceId)];
  if (filters.status) conds.push(eq(tasks.status, filters.status));
  if (filters.assigneeId) conds.push(eq(tasks.assigneeId, filters.assigneeId));
  if (filters.project) {
    const projectDocs = db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.workspaceId, workspaceId), eq(documents.projectName, filters.project)));
    conds.push(inArray(tasks.documentId, projectDocs));
  }
  const rows = await selectTasks().where(and(...conds)).orderBy(desc(tasks.createdAt));
  return rows.map(toTaskDTO);
}

export async function listTasks(actor: Actor, workspaceId: string, filters: TaskFilters = {}) {
  await requireMember(actor, workspaceId);
  return listWorkspaceTasks(workspaceId, filters);
}

async function loadTask(id: string) {
  const [row] = await selectTasks().where(eq(tasks.id, id)).limit(1);
  return row ? toTaskDTO(row) : null;
}

// Referential checks the FK constraints cannot express: same-workspace assignee & origin doc
async function assertRefs(workspaceId: string, refs: { assigneeIds?: (string | null | undefined)[]; documentId?: string | null }) {
  const assigneeIds = [...new Set((refs.assigneeIds ?? []).filter((x): x is string => !!x))];
  if (assigneeIds.length) {
    const found = await db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), inArray(workspaceMembers.userId, assigneeIds)));
    if (found.length !== assigneeIds.length) throw badRequest('Assignee harus anggota workspace ini.');
  }
  if (refs.documentId) {
    const [doc] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.id, refs.documentId), eq(documents.workspaceId, workspaceId)))
      .limit(1);
    if (!doc) throw badRequest('Dokumen asal tidak ditemukan di workspace ini.');
  }
}

export interface TaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  documentId?: string | null;
}

export async function createTask(actor: Actor, workspaceId: string, input: TaskInput) {
  await requireMember(actor, workspaceId, 'Editor');
  await assertRefs(workspaceId, { assigneeIds: [input.assigneeId], documentId: input.documentId });
  const id = randomUUID();
  await db.insert(tasks).values({
    id,
    workspaceId,
    title: input.title,
    description: input.description ?? null,
    status: input.status ?? 'todo',
    priority: input.priority ?? 'medium',
    assigneeId: input.assigneeId ?? null,
    dueDate: input.dueDate ?? null,
    documentId: input.documentId ?? null,
  });
  return (await loadTask(id))!;
}

// AI commit: drafts confirmed by the user, all bound to their origin document
export async function createTasksBatch(
  actor: Actor,
  input: { workspaceId: string; documentId: string; tasks: Omit<TaskInput, 'status' | 'documentId'>[] }
) {
  await requireMember(actor, input.workspaceId, 'Editor');
  await assertRefs(input.workspaceId, { assigneeIds: input.tasks.map((t) => t.assigneeId), documentId: input.documentId });
  const rows = input.tasks.map((t) => ({
    id: randomUUID(),
    workspaceId: input.workspaceId,
    documentId: input.documentId,
    title: t.title,
    description: t.description ?? null,
    status: 'todo' as const,
    priority: t.priority ?? 'medium',
    assigneeId: t.assigneeId ?? null,
    dueDate: t.dueDate ?? null,
    extractedByAi: true,
  }));
  await db.insert(tasks).values(rows);
  const created = await selectTasks().where(inArray(tasks.id, rows.map((r) => r.id)));
  return created.map(toTaskDTO);
}

export async function updateTask(actor: Actor, taskId: string, patch: Partial<TaskInput>) {
  const task = await loadTask(taskId);
  if (!task) throw notFound('Tugas');
  await requireMember(actor, task.workspaceId, 'Editor');
  await assertRefs(task.workspaceId, { assigneeIds: [patch.assigneeId], documentId: patch.documentId });
  const fields = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  if (Object.keys(fields).length) await db.update(tasks).set(fields).where(eq(tasks.id, taskId));
  return (await loadTask(taskId))!;
}

export const updateTaskStatus = (actor: Actor, taskId: string, status: TaskStatus) => updateTask(actor, taskId, { status });

export async function deleteTask(actor: Actor, taskId: string) {
  const task = await loadTask(taskId);
  if (!task) throw notFound('Tugas');
  await requireMember(actor, task.workspaceId, 'Editor');
  await db.delete(tasks).where(eq(tasks.id, taskId));
  return { id: taskId };
}
