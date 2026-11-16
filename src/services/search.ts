// Process 7.0 — Centralized search. Scoped to one workspace the caller belongs to (FR-SCH-04).
import { and, count, desc, eq, exists, like, or, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { documentTags, documents, tags, tasks } from '@/db/schema';
import type { Actor } from '@/lib/auth';
import type { SearchResultDTO, SearchType, TaskStatus } from '@/lib/domain';
import { normalizeTag } from '@/lib/markdown';
import { escapeLike, requireMember } from './access';
import { tagsByDocument } from './documents';

const LIMIT = 8;

// shortcut: LIKE scan is fine for thousands of rows (NFR-PERF-02); switch to a FULLTEXT index beyond that
function snippet(content: string, query: string) {
  const flat = content.replace(/\s+/g, ' ').trim();
  const at = query ? flat.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return flat.slice(0, 120) || null;
  const start = Math.max(0, at - 50);
  return `${start ? '…' : ''}${flat.slice(start, at + query.length + 70)}…`;
}

export async function searchWorkspace(
  actor: Actor,
  input: { workspaceId: string; query: string; type: SearchType; tag?: string; status?: TaskStatus }
): Promise<SearchResultDTO[]> {
  await requireMember(actor, input.workspaceId);
  const { workspaceId, query, type } = input;
  const tag = input.tag ? normalizeTag(input.tag) : '';
  if (!query && !tag && !input.status) return [];
  const pattern = `%${escapeLike(query)}%`;
  const results: SearchResultDTO[] = [];

  if ((type === 'all' || type === 'notes') && !input.status) {
    const docTagMatch = (cond: SQL) =>
      exists(
        db
          .select({ one: documentTags.tagId })
          .from(documentTags)
          .innerJoin(tags, eq(tags.id, documentTags.tagId))
          .where(and(eq(documentTags.documentId, documents.id), cond))
      );
    const conds = [eq(documents.workspaceId, workspaceId), eq(documents.isArchived, false)];
    if (query) {
      conds.push(
        or(
          like(documents.title, pattern),
          like(documents.content, pattern),
          like(documents.projectName, pattern),
          docTagMatch(like(tags.name, `%${escapeLike(normalizeTag(query) || query)}%`))
        )!
      );
    }
    if (tag) conds.push(docTagMatch(eq(tags.name, tag)));
    const [rows, tagMap] = await Promise.all([
      db
        .select({ id: documents.id, title: documents.title, content: documents.content, projectName: documents.projectName })
        .from(documents)
        .where(and(...conds))
        .orderBy(desc(documents.updatedAt))
        .limit(LIMIT),
      tagsByDocument(workspaceId),
    ]);
    for (const d of rows) {
      results.push({
        type: 'note',
        id: d.id,
        title: d.title,
        snippet: snippet(d.content, query),
        tags: tagMap.get(d.id) ?? [],
        projectName: d.projectName,
      });
    }
  }

  if ((type === 'all' || type === 'tasks') && !tag) {
    const conds = [eq(tasks.workspaceId, workspaceId)];
    if (query) conds.push(or(like(tasks.title, pattern), like(tasks.description, pattern))!);
    if (input.status) conds.push(eq(tasks.status, input.status));
    const rows = await db
      .select({ id: tasks.id, title: tasks.title, description: tasks.description, status: tasks.status })
      .from(tasks)
      .where(and(...conds))
      .orderBy(desc(tasks.updatedAt))
      .limit(LIMIT);
    for (const t of rows) {
      results.push({ type: 'task', id: t.id, title: t.title, snippet: t.description ? snippet(t.description, query) : null, status: t.status });
    }
  }

  if ((type === 'all' || type === 'projects') && query && !tag && !input.status) {
    const rows = await db
      .select({ name: documents.projectName, docs: count() })
      .from(documents)
      .where(and(eq(documents.workspaceId, workspaceId), eq(documents.isArchived, false), like(documents.projectName, pattern)))
      .groupBy(documents.projectName)
      .limit(5);
    for (const p of rows) {
      results.push({ type: 'project', id: p.name, title: p.name, snippet: `${p.docs} dokumen`, projectName: p.name });
    }
  }

  return results;
}
