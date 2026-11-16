import { api, query, readJson } from '@/lib/http';
import { createDocumentSchema } from '@/lib/validations';
import { createDocument, listDocuments } from '@/services/documents';

type P = { wsId: string };

export const GET = api<P>(async ({ req, params, actor }) =>
  listDocuments(actor, params.wsId, { project: query(req, 'project'), tag: query(req, 'tag'), archived: query(req, 'archived') === '1' })
);
export const POST = api<P>(
  async ({ req, params, actor }) =>
    createDocument(actor, { ...(await readJson(req, createDocumentSchema.omit({ workspaceId: true }))), workspaceId: params.wsId }),
  { status: 201 }
);
