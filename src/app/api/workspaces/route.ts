import { api, readJson } from '@/lib/http';
import { workspaceNameSchema } from '@/lib/validations';
import { createWorkspace, listMyWorkspaces } from '@/services/workspaces';

export const GET = api(async ({ actor }) => listMyWorkspaces(actor));
export const POST = api(async ({ req, actor }) => createWorkspace(actor, (await readJson(req, workspaceNameSchema)).name), { status: 201 });
