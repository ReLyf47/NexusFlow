import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { getActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // DB-verified check (not just a token signature) so revoked sessions cannot loop
  if (await getActor()) redirect('/');
  return <AuthForm mode="login" next={next} showDemo={process.env.NODE_ENV !== 'production'} />;
}
