import { api, query } from '@/lib/http';
import { badRequest } from '@/lib/errors';
import { aiStatus } from '@/services/ai';

export const GET = api(async ({ req, actor }) => {
  const workspaceId = query(req, 'workspaceId');
  if (!workspaceId) throw badRequest('Parameter workspaceId wajib diisi.');
  return aiStatus(actor, workspaceId);
});
