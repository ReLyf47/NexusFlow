import { notFound, redirect } from 'next/navigation';
import { WorkspaceClient } from '@/components/workspace-client';
import { getActor } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { getSnapshot, workspaceIdBySlug } from '@/services/workspaces';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ doc?: string; view?: string }>;
}) {
  const [{ slug }, { doc, view }] = await Promise.all([params, searchParams]);
  const actor = await getActor();
  if (!actor) redirect(`/login?next=/w/${encodeURIComponent(slug)}`);
  try {
    const workspaceId = await workspaceIdBySlug(actor, slug);
    const snapshot = await getSnapshot(actor, workspaceId, doc);
    return <WorkspaceClient initialData={snapshot} initialView={view === 'kanban' ? 'kanban' : 'notes'} />;
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}
