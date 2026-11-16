import { api, readJson } from '@/lib/http';
import { updateTaskStatusSchema } from '@/lib/validations';
import { updateTaskStatus } from '@/services/tasks';

export const PATCH = api<{ taskId: string }>(async ({ req, params, actor }) => {
  const { status } = await readJson(req, updateTaskStatusSchema.omit({ taskId: true }));
  return updateTaskStatus(actor, params.taskId, status);
});
