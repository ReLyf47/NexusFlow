import { api, query, readJson } from '@/lib/http';
import { workspaceNameSchema } from '@/lib/validations';
import { deleteWorkspace, getSnapshot, renameWorkspace } from '@/services/workspaces';

type P = { wsId: string };

export const GET = api<P>(async ({ req, params, actor }) => getSnapshot(actor, params.wsId, query(req, 'doc')));
export const PATCH = api<P>(async ({ req, params, actor }) => renameWorkspace(actor, params.wsId, (await readJson(req, workspaceNameSchema)).name));
export const DELETE = api<P>(async ({ params, actor }) => deleteWorkspace(actor, params.wsId));
