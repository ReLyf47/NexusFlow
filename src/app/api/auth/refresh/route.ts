import { api, readJson } from '@/lib/http';
import { refreshSchema } from '@/lib/validations';
import { refreshSession } from '@/services/auth';

export const POST = api(async ({ req }) => refreshSession((await readJson(req, refreshSchema)).refreshToken), { auth: false });
