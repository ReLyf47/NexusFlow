import { redirect } from 'next/navigation';
import { CreateWorkspaceForm } from '@/components/auth-form';
import { getActor } from '@/lib/auth';
import { listMyWorkspaces } from '@/services/workspaces';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const actor = await getActor();
  if (!actor) redirect('/login');
  const [first] = await listMyWorkspaces(actor);
  if (first) redirect(`/w/${first.slug}`);
  // Removed from every workspace: offer to start a new one
  return (
    <main className="flex-1 flex items-center justify-center p-4 relative z-10">
      <CreateWorkspaceForm name={actor.name} />
    </main>
  );
}
