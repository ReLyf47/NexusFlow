import { api, readJson } from '@/lib/http';
import { extractSchema } from '@/lib/validations';
import { extractDocumentActions } from '@/services/ai';

export const POST = api(async ({ req, actor }) => extractDocumentActions(actor, (await readJson(req, extractSchema)).documentId));
