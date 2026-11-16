import { api, readJson } from '@/lib/http';
import { memberRoleSchema } from '@/lib/validations';
import { removeMember, updateMemberRole } from '@/services/workspaces';

type P = { wsId: string; memberId: string };

export const PATCH = api<P>(async ({ req, params, actor }) =>
  updateMemberRole(actor, params.wsId, params.memberId, (await readJson(req, memberRoleSchema)).role)
);
export const DELETE = api<P>(async ({ params, actor }) => removeMember(actor, params.wsId, params.memberId));
