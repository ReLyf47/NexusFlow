import { api } from '@/lib/http';
import { searchQuerySchema } from '@/lib/validations';
import { searchWorkspace } from '@/services/search';

type P = { wsId: string };

// GET ?q=&type=all|notes|tasks|projects&tag=&status=
export const GET = api<P>(async ({ req, params, actor }) => {
  const sp = req.nextUrl.searchParams;
  return searchWorkspace(
    actor,
    searchQuerySchema.parse({
      workspaceId: params.wsId,
      query: sp.get('q') ?? '',
      type: sp.get('type') ?? undefined,
      tag: sp.get('tag') || undefined,
      status: sp.get('status') || undefined,
    })
  );
});
