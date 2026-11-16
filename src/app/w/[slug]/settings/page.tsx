import { notFound, redirect } from 'next/navigation';
import { SettingsClient } from '@/components/settings-client';
import { getActor } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { getSnapshot, workspaceIdBySlug } from '@/services/workspaces';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const actor = await getActor();
  if (!actor) redirect(`/login?next=/w/${encodeURIComponent(slug)}/settings`);
  try {
    const snapshot = await getSnapshot(actor, await workspaceIdBySlug(actor, slug), null);
    return <SettingsClient data={snapshot} />;
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}
