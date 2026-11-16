import { api } from '@/lib/http';
import { getRelatedContext } from '@/services/documents';

export const GET = api<{ docId: string }>(async ({ params, actor }) => getRelatedContext(actor, params.docId));
