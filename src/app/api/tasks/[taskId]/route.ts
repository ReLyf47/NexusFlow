import { api, readJson } from '@/lib/http';
import { updateTaskSchema } from '@/lib/validations';
import { deleteTask, updateTask } from '@/services/tasks';

type P = { taskId: string };

export const PUT = api<P>(async ({ req, params, actor }) => updateTask(actor, params.taskId, await readJson(req, updateTaskSchema)));
export const DELETE = api<P>(async ({ params, actor }) => deleteTask(actor, params.taskId));
