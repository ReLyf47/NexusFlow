import { api, readJson } from '@/lib/http';
import { inviteMemberSchema } from '@/lib/validations';
import { inviteMember, listMembers } from '@/services/workspaces';

type P = { wsId: string };

export const GET = api<P>(async ({ params, actor }) => listMembers(actor, params.wsId));
export const POST = api<P>(async ({ req, params, actor }) => inviteMember(actor, params.wsId, await readJson(req, inviteMemberSchema)), { status: 201 });
