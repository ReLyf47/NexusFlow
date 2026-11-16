import { api, readJson } from '@/lib/http';
import { commitTasksSchema } from '@/lib/validations';
import { createTasksBatch } from '@/services/tasks';

type P = { wsId: string };

// Commit of AI-extracted drafts, all bound to their origin document (originDocId)
export const POST = api<P>(
  async ({ req, params, actor }) =>
    createTasksBatch(actor, { ...(await readJson(req, commitTasksSchema.omit({ workspaceId: true }))), workspaceId: params.wsId }),
  { status: 201 }
);
