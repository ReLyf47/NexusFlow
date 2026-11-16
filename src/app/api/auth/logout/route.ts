import { clearSessionCookies } from '@/lib/auth';
import { api } from '@/lib/http';
import { logout } from '@/services/auth';

export const POST = api(async ({ actor }) => {
  await logout(actor);
  await clearSessionCookies();
});
