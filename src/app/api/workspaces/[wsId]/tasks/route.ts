import { TASK_STATUSES, type TaskStatus } from '@/lib/domain';
import { api, query, readJson } from '@/lib/http';
import { createTaskSchema } from '@/lib/validations';
import { createTask, listTasks } from '@/services/tasks';

type P = { wsId: string };

export const GET = api<P>(async ({ req, params, actor }) => {
  const status = query(req, 'status');
  return listTasks(actor, params.wsId, {
    status: TASK_STATUSES.includes(status as TaskStatus) ? (status as TaskStatus) : undefined,
    assigneeId: query(req, 'assigneeId'),
    project: query(req, 'project'),
  });
});
export const POST = api<P>(
  async ({ req, params, actor }) => createTask(actor, params.wsId, await readJson(req, createTaskSchema.omit({ workspaceId: true }))),
  { status: 201 }
);
