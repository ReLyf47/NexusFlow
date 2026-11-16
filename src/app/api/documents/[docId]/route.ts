import { api, query, readJson } from '@/lib/http';
import { updateDocumentSchema } from '@/lib/validations';
import { deleteDocument, getDocument, updateDocument } from '@/services/documents';

type P = { docId: string };

export const GET = api<P>(async ({ params, actor }) => getDocument(actor, params.docId));
export const PUT = api<P>(async ({ req, params, actor }) => updateDocument(actor, params.docId, await readJson(req, updateDocumentSchema)));
// ?hard=1 deletes permanently; default archives (soft delete)
export const DELETE = api<P>(async ({ req, params, actor }) => deleteDocument(actor, params.docId, query(req, 'hard') === '1'));
