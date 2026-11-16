import { api, readJson } from '@/lib/http';
import { projectRenameSchema } from '@/lib/validations';
import { renameProject } from '@/services/workspaces';

type P = { wsId: string };

// Rename (or merge into another project / move back to "General")
export const PATCH = api<P>(async ({ req, params, actor }) => {
  const { from, to } = await readJson(req, projectRenameSchema);
  return renameProject(actor, params.wsId, from, to);
});
