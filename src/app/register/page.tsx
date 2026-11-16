import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { getActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  if (await getActor()) redirect('/');
  return <AuthForm mode="register" />;
}
