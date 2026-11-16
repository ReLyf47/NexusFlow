// Process 3.0 (Knowledge Base) & 5.0 (Related Context Engine)
import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, like, notInArray, or } from 'drizzle-orm';
import { db } from '@/db';
import { documentLinks, documentTags, documents, tags, tasks } from '@/db/schema';
import type { Actor } from '@/lib/auth';
import { rankRelated } from '@/lib/context';
import { DEFAULT_PROJECT, tagColor, type DocSummaryDTO, type DocumentDTO, type RelatedContextDTO, type Role } from '@/lib/domain';
import { forbidden, notFound } from '@/lib/errors';
import { extractWikilinks, normalizeTag } from '@/lib/markdown';
import { escapeLike, requireMember, type Executor } from './access';

export const docSummaryColumns = {
  id: documents.id,
  workspaceId: documents.workspaceId,
  title: documents.title,
  projectName: documents.projectName,
  authorId: documents.authorId,
  isArchived: documents.isArchived,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
};

type DocRow = { id: string; title: string; projectName: string; authorId: string; isArchived: boolean; createdAt: Date; updatedAt: Date };

export const toDocSummary = (r: DocRow, tagNames: string[]): DocSummaryDTO => ({
  id: r.id,
  title: r.title,
  projectName: r.projectName,
  authorId: r.authorId,
  isArchived: r.isArchived,
  tags: tagNames,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

export async function tagsByDocument(workspaceId: string) {
  const rows = await db
    .select({ documentId: documentTags.documentId, name: tags.name })
    .from(documentTags)
    .innerJoin(tags, eq(tags.id, documentTags.tagId))
    .where(eq(tags.workspaceId, workspaceId));
  const map = new Map<string, string[]>();
  for (const r of rows) map.set(r.documentId, [...(map.get(r.documentId) ?? []), r.name]);
  for (const list of map.values()) list.sort();
  return map;
}

async function loadDocRow(id: string) {
  const [row] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return row ?? null;
}

async function toDocumentDTO(row: NonNullable<Awaited<ReturnType<typeof loadDocRow>>>): Promise<DocumentDTO> {
  const tagRows = await db
    .select({ name: tags.name })
    .from(documentTags)
    .innerJoin(tags, eq(tags.id, documentTags.tagId))
    .where(eq(documentTags.documentId, row.id));
  return { ...toDocSummary(row, tagRows.map((t) => t.name).sort()), content: row.content, summary: row.summary };
}

export async function listDocuments(actor: Actor, workspaceId: string, opts: { project?: string; tag?: string; archived?: boolean } = {}) {
  await requireMember(actor, workspaceId);
  const conds = [eq(documents.workspaceId, workspaceId), eq(documents.isArchived, opts.archived ?? false)];
  if (opts.project) conds.push(eq(documents.projectName, opts.project));
  const [rows, tagMap] = await Promise.all([
    db.select(docSummaryColumns).from(documents).where(and(...conds)).orderBy(desc(documents.updatedAt)),
    tagsByDocument(workspaceId),
  ]);
  const tag = opts.tag ? normalizeTag(opts.tag) : null;
  return rows
    .map((r) => toDocSummary(r, tagMap.get(r.id) ?? []))
    .filter((d) => !tag || d.tags.includes(tag));
}

// ---------- Related Context (FR-CTX-01..04) ----------

export async function buildContext(workspaceId: string, doc: { id: string; title: string; projectName: string }): Promise<RelatedContextDTO> {
  const [liveDocs, tagMap, links, linkedTasks] = await Promise.all([
    db
      .select({ id: documents.id, title: documents.title, projectName: documents.projectName })
      .from(documents)
      .where(and(eq(documents.workspaceId, workspaceId), eq(documents.isArchived, false))),
    tagsByDocument(workspaceId),
    db
      .select()
      .from(documentLinks)
      .where(or(eq(documentLinks.sourceDocId, doc.id), eq(documentLinks.targetDocId, doc.id))),
    db
      .select({ id: tasks.id, title: tasks.title, status: tasks.status, priority: tasks.priority })
      .from(tasks)
      .where(eq(tasks.documentId, doc.id)),
  ]);

  const live = new Map(liveDocs.map((d) => [d.id, d]));
  const ref = (id: string, anchorText: string | null) => ({ id, title: live.get(id)!.title, anchorText });
  const outbound = links.filter((l) => l.sourceDocId === doc.id && live.has(l.targetDocId)).map((l) => ref(l.targetDocId, l.anchorText));
  const backlinks = links.filter((l) => l.targetDocId === doc.id && live.has(l.sourceDocId)).map((l) => ref(l.sourceDocId, l.anchorText));

  const tagSets = new Map([...tagMap].map(([id, names]) => [id, new Set(names)]));
  const ranked = rankRelated(doc, liveDocs, tagSets, new Set([...outbound, ...backlinks].map((l) => l.id)));

  return {
    activeDocId: doc.id,
    ranked: ranked.slice(0, 12),
    sameProjectDocs: ranked.filter((r) => r.sameProject),
    sharedTagDocs: ranked.filter((r) => r.matchedTags.length > 0),
    backlinks,
    outbound,
    activeTasks: linkedTasks.filter((t) => t.status !== 'done'),
    stats: { outbound: outbound.length, inbound: backlinks.length, tasks: linkedTasks.length, activeConnections: ranked.length },
  };
}

async function documentResult(id: string) {
  const row = (await loadDocRow(id))!;
  const [document, context] = await Promise.all([toDocumentDTO(row), buildContext(row.workspaceId, row)]);
  return { document, context };
}

export async function getDocument(actor: Actor, docId: string) {
  const row = await loadDocRow(docId);
  if (!row) throw notFound('Dokumen');
  await requireMember(actor, row.workspaceId);
  return documentResult(docId);
}

export async function getRelatedContext(actor: Actor, docId: string) {
  const row = await loadDocRow(docId);
  if (!row) throw notFound('Dokumen');
  await requireMember(actor, row.workspaceId);
  return buildContext(row.workspaceId, row);
}

// ---------- Tags & wikilinks maintenance ----------

async function setDocumentTags(ex: Executor, workspaceId: string, docId: string, rawNames: string[]) {
  const names = [...new Set(rawNames.map(normalizeTag).filter(Boolean))];
  await ex.delete(documentTags).where(eq(documentTags.documentId, docId));
  if (names.length) {
    await ex
      .insert(tags)
      .ignore()
      .values(names.map((name) => ({ id: randomUUID(), workspaceId, name, color: tagColor(name) })));
    const rows = await ex
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.workspaceId, workspaceId), inArray(tags.name, names)));
    await ex.insert(documentTags).values(rows.map((t) => ({ documentId: docId, tagId: t.id })));
  }
  // Drop tags no document uses anymore so the tag index stays truthful
  const used = ex.select({ id: documentTags.tagId }).from(documentTags);
  await ex.delete(tags).where(and(eq(tags.workspaceId, workspaceId), notInArray(tags.id, used)));
}

async function syncOutboundLinks(ex: Executor, workspaceId: string, docId: string, content: string) {
  const titles = extractWikilinks(content);
  await ex.delete(documentLinks).where(eq(documentLinks.sourceDocId, docId));
  if (!titles.length) return;
  const targets = await ex
    .select({ id: documents.id, title: documents.title })
    .from(documents)
    .where(and(eq(documents.workspaceId, workspaceId), eq(documents.isArchived, false), inArray(documents.title, titles)));
  // MariaDB's default collation compares case-insensitively; mirror that when mapping back
  const byTitle = new Map(targets.map((t) => [t.title.toLowerCase(), t.id]));
  const seen = new Set<string>();
  const rows = titles.flatMap((title) => {
    const targetDocId = byTitle.get(title.toLowerCase());
    if (!targetDocId || targetDocId === docId || seen.has(targetDocId)) return [];
    seen.add(targetDocId);
    return [{ id: randomUUID(), sourceDocId: docId, targetDocId, anchorText: title.slice(0, 100) }];
  });
  if (rows.length) await ex.insert(documentLinks).values(rows);
}

// Re-resolve links of every document that mentions one of these titles
// (needed after a document is created, renamed, archived or deleted)
async function resyncReferrers(ex: Executor, workspaceId: string, titles: string[], skipId?: string) {
  const mentions = [...new Set(titles)].map((t) => like(documents.content, `%[[${escapeLike(t)}]]%`));
  const referrers = await ex
    .select({ id: documents.id, content: documents.content })
    .from(documents)
    .where(and(eq(documents.workspaceId, workspaceId), or(...mentions)));
  for (const r of referrers) if (r.id !== skipId) await syncOutboundLinks(ex, workspaceId, r.id, r.content);
}

// ---------- RBAC rules specific to notes ----------

// RBAC matrix: creating a new project is Admin-only; Editors pick existing ones
async function assertProjectAllowed(workspaceId: string, projectName: string, role: Role) {
  if (projectName === DEFAULT_PROJECT || role === 'Admin') return;
  const [existing] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.workspaceId, workspaceId), eq(documents.projectName, projectName)))
    .limit(1);
  if (!existing) throw forbidden('Hanya Admin yang dapat membuat proyek baru.');
}

// RBAC matrix: Editors may only delete/archive notes they authored
function assertCanRemove(doc: { authorId: string }, actor: Actor, role: Role) {
  if (role === 'Editor' && doc.authorId !== actor.id) {
    throw forbidden('Editor hanya dapat mengarsipkan atau menghapus catatan miliknya sendiri.');
  }
}

// ---------- Mutations ----------

export async function createDocument(
  actor: Actor,
  input: { workspaceId: string; title: string; content: string; projectName?: string; tags?: string[] }
) {
  const { effective } = await requireMember(actor, input.workspaceId, 'Editor');
  const projectName = input.projectName ?? DEFAULT_PROJECT;
  await assertProjectAllowed(input.workspaceId, projectName, effective);
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(documents).values({
      id,
      workspaceId: input.workspaceId,
      authorId: actor.id,
      title: input.title,
      content: input.content,
      projectName,
    });
    if (input.tags?.length) await setDocumentTags(tx, input.workspaceId, id, input.tags);
    await syncOutboundLinks(tx, input.workspaceId, id, input.content);
    await resyncReferrers(tx, input.workspaceId, [input.title], id);
  });
  return documentResult(id);
}

export interface DocumentPatch {
  title?: string;
  content?: string;
  projectName?: string;
  tags?: string[];
  summary?: string | null;
  isArchived?: boolean;
}

export async function updateDocument(actor: Actor, docId: string, patch: DocumentPatch) {
  const doc = await loadDocRow(docId);
  if (!doc) throw notFound('Dokumen');
  const { effective } = await requireMember(actor, doc.workspaceId, 'Editor');
  const archiveChanged = patch.isArchived !== undefined && patch.isArchived !== doc.isArchived;
  const titleChanged = patch.title !== undefined && patch.title !== doc.title;
  if (archiveChanged) assertCanRemove(doc, actor, effective);
  if (patch.projectName && patch.projectName !== doc.projectName) {
    await assertProjectAllowed(doc.workspaceId, patch.projectName, effective);
  }

  const { tags: tagNames, ...columns } = patch;
  const fields = Object.fromEntries(Object.entries(columns).filter(([, v]) => v !== undefined));
  await db.transaction(async (tx) => {
    if (Object.keys(fields).length) await tx.update(documents).set(fields).where(eq(documents.id, docId));
    if (tagNames) await setDocumentTags(tx, doc.workspaceId, docId, tagNames);
    if (patch.content !== undefined) await syncOutboundLinks(tx, doc.workspaceId, docId, patch.content);
    if (titleChanged || archiveChanged) {
      await resyncReferrers(tx, doc.workspaceId, [doc.title, patch.title ?? doc.title], docId);
    }
  });
  return documentResult(docId);
}

// Soft delete = archive (restorable); hard delete removes the row, tasks keep living (SET NULL)
export async function deleteDocument(actor: Actor, docId: string, hard: boolean) {
  const doc = await loadDocRow(docId);
  if (!doc) throw notFound('Dokumen');
  const { effective } = await requireMember(actor, doc.workspaceId, 'Editor');
  assertCanRemove(doc, actor, effective);
  await db.transaction(async (tx) => {
    if (hard) await tx.delete(documents).where(eq(documents.id, docId));
    else await tx.update(documents).set({ isArchived: true }).where(eq(documents.id, docId));
    await resyncReferrers(tx, doc.workspaceId, [doc.title], docId);
  });
  return { id: docId, hard };
}
