import { api } from '@/lib/http';
import { listMyWorkspaces } from '@/services/workspaces';

export const GET = api(async ({ actor }) => ({
  user: { id: actor.id, name: actor.name, email: actor.email, avatarUrl: actor.avatarUrl },
  workspaces: await listMyWorkspaces(actor),
}));
