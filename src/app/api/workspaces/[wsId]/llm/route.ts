import { api, readJson } from '@/lib/http';
import { llmSettingsSchema } from '@/lib/validations';
import { getLlmSettings, updateLlmSettings } from '@/services/workspaces';

type P = { wsId: string };

export const GET = api<P>(async ({ params, actor }) => getLlmSettings(actor, params.wsId));
export const PUT = api<P>(async ({ req, params, actor }) => updateLlmSettings(actor, params.wsId, await readJson(req, llmSettingsSchema)));
