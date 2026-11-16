import { api, readJson } from '@/lib/http';
import { loginSchema } from '@/lib/validations';
import { login } from '@/services/auth';

// Returns { token, refreshToken, expiresIn, user } for Bearer clients (mobile app)
export const POST = api(async ({ req }) => login(await readJson(req, loginSchema)), { auth: false });
