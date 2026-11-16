// Process 6.0 — AI automation. Failures stay isolated from the editor/board (NFR-REL-01).
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { documents, users, workspaceMembers, workspaces } from '@/db/schema';
import { createAdapter, extractActionItems, resolveLlmConfig, summarize } from '@/lib/ai';
import type { Actor } from '@/lib/auth';
import { decryptSecret } from '@/lib/crypto';
import { badRequest, notFound } from '@/lib/errors';
import { requireMember } from './access';

async function adapterFor(workspaceId: string) {
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  if (!ws) throw notFound('Workspace');
  return createAdapter(resolveLlmConfig(ws, decryptSecret(ws.llmApiKey)));
}

async function loadDoc(documentId: string) {
  const [doc] = await db
    .select({ id: documents.id, workspaceId: documents.workspaceId, content: documents.content, title: documents.title })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!doc) throw notFound('Dokumen');
  return doc;
}

export async function summarizeDocument(actor: Actor, input: { documentId: string; text?: string; save: boolean }) {
  const doc = await loadDoc(input.documentId);
  await requireMember(actor, doc.workspaceId, 'Editor');
  const source = (input.text ?? doc.content).trim();
  if (source.length < 20) throw badRequest('Teks terlalu pendek untuk dirangkum (minimal 20 karakter).');
  const adapter = await adapterFor(doc.workspaceId);
  const summary = await summarize(adapter, `# ${doc.title}\n\n${source}`);
  // Only a whole-document summary is persisted; a summary of a selection is returned for insertion only
  const persisted = input.save && input.text === undefined;
  if (persisted) {
    await db
      .update(documents)
      .set({ summary: summary.map((s) => `- ${s}`).join('\n') })
      .where(eq(documents.id, doc.id));
  }
  return { summary, engine: adapter.label, persisted };
}

export async function extractDocumentActions(actor: Actor, documentId: string) {
  const doc = await loadDoc(documentId);
  await requireMember(actor, doc.workspaceId, 'Editor');
  if (doc.content.trim().length < 10) throw badRequest('Dokumen terlalu pendek untuk diekstraksi.');
  const [adapter, members] = await Promise.all([
    adapterFor(doc.workspaceId),
    db
      .select({ id: users.id, name: users.name })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, doc.workspaceId)),
  ]);
  const actionItems = await extractActionItems(adapter, doc.content, members);
  return { actionItems, engine: adapter.label, documentId: doc.id };
}

export async function aiStatus(actor: Actor, workspaceId: string) {
  await requireMember(actor, workspaceId);
  const adapter = await adapterFor(workspaceId);
  return { engine: adapter.label, online: await adapter.ping() };
}
