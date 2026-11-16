import { api, readJson } from '@/lib/http';
import { registerSchema } from '@/lib/validations';
import { register } from '@/services/auth';

export const POST = api(async ({ req }) => register(await readJson(req, registerSchema)), { auth: false, status: 201 });
