import { api, readJson } from '@/lib/http';
import { summarizeSchema } from '@/lib/validations';
import { summarizeDocument } from '@/services/ai';

export const POST = api(async ({ req, actor }) => summarizeDocument(actor, await readJson(req, summarizeSchema)));
