'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import {
  aiStatusAction,
  createDocumentAction,
  createTaskAction,
  deleteDocumentAction,
  deleteTaskAction,
  getDocumentAction,
  setRolePreviewAction,
  updateDocumentAction,
  updateTaskAction,
} from '@/actions';
import { ContextPanel } from '@/components/context-panel';
import { EditorView } from '@/components/editor-view';
import { KanbanBoard } from '@/components/kanban-board';
import { MobileNav } from '@/components/mobile-nav';
import { AiExtractModal } from '@/components/modals/ai-extract-modal';
import { SearchModal } from '@/components/modals/search-modal';
import { TaskModal, type TaskFormValues } from '@/components/modals/task-modal';
import { Navbar } from '@/components/navbar';
import { Sidebar, type EngineStatus } from '@/components/sidebar';
import { useRun } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/dialog';
import { ViewerBanner } from '@/components/viewer-banner';
import {
  atLeast,
  DEFAULT_PROJECT,
  NEXT_STATUS,
  type DocSummaryDTO,
  type DocumentDTO,
  type RelatedContextDTO,
  type Role,
  type SearchResultDTO,
  type TaskDTO,
  type TaskStatus,
  type WorkspaceSnapshotDTO,
} from '@/lib/domain';

type View = 'notes' | 'kanban';

const summaryOf = (d: DocumentDTO): DocSummaryDTO => ({
  id: d.id,
  title: d.title,
  projectName: d.projectName,
  authorId: d.authorId,
  isArchived: d.isArchived,
  tags: d.tags,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

export function WorkspaceClient({ initialData, initialView }: { initialData: WorkspaceSnapshotDTO; initialView?: View }) {
  const run = useRun();
  const { workspace, me, members } = initialData;
  const aiLabel = `${workspace.llm.provider.toUpperCase()} // ${workspace.llm.model.toUpperCase()}`;

  const [role, setRole] = React.useState<Role>(initialData.effectiveRole);
  const [view, setView] = React.useState<View>(initialView ?? 'notes');
  const [docs, setDocs] = React.useState(initialData.documents);
  const [tasks, setTasks] = React.useState(initialData.tasks);
  const [activeDoc, setActiveDoc] = React.useState<DocumentDTO | null>(initialData.activeDoc);
  const [context, setContext] = React.useState<RelatedContextDTO | null>(initialData.context);
  const [freshDocId, setFreshDocId] = React.useState<string | null>(null);
  const [editorRev, setEditorRev] = React.useState(0);
  const [projectFilter, setProjectFilter] = React.useState<string | null>(null);
  const [tagFilter, setTagFilter] = React.useState<string | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [sheet, setSheet] = React.useState<'docs' | 'context' | null>(null);
  const [search, setSearch] = React.useState<'search' | 'link' | null>(null);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [taskModal, setTaskModal] = React.useState<{ task: TaskDTO | null; defaults?: Partial<TaskFormValues> } | null>(null);
  const [status, setStatus] = React.useState<EngineStatus>({ db: { state: 'unknown' }, ai: { engine: aiLabel, online: null } });

  const canEdit = atLeast(role, 'Editor');

  // Keep ?doc= & ?view= in the URL so reloads and shared links land on the same screen
  React.useEffect(() => {
    const url = new URL(location.href);
    if (activeDoc) url.searchParams.set('doc', activeDoc.id);
    else url.searchParams.delete('doc');
    if (view === 'kanban') url.searchParams.set('view', 'kanban');
    else url.searchParams.delete('view');
    history.replaceState(history.state, '', url);
  }, [activeDoc, view]);

  // Real engine health (status footer): DB every 30s, AI gateway every 60s
  React.useEffect(() => {
    let alive = true;
    const checkDb = async () => {
      const res = await fetch('/api/health', { cache: 'no-store' }).catch(() => null);
      const body = res ? await res.json().catch(() => null) : null;
      if (alive) setStatus((s) => ({ ...s, db: body?.db === 'up' ? { state: 'up', latencyMs: body.latencyMs } : { state: 'down' } }));
    };
    const checkAi = async () => {
      const res = await aiStatusAction({ workspaceId: workspace.id }).catch(() => null);
      if (alive) setStatus((s) => ({ ...s, ai: res?.ok ? { engine: res.data.engine, online: res.data.online } : { ...s.ai, online: false } }));
    };
    void checkDb();
    void checkAi();
    const dbTimer = setInterval(checkDb, 30_000);
    const aiTimer = setInterval(checkAi, 60_000);
    return () => {
      alive = false;
      clearInterval(dbTimer);
      clearInterval(aiTimer);
    };
  }, [workspace.id]);

  // Global shortcuts: Cmd/Ctrl+K search, Cmd/Ctrl+E AI extraction
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'k') {
        e.preventDefault();
        setSearch('search');
      } else if (key === 'e' && canEdit && activeDoc && !activeDoc.isArchived) {
        e.preventDefault();
        setAiOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canEdit, activeDoc]);

  // ---------- Documents ----------

  const applyDocResult = React.useCallback((res: { document: DocumentDTO; context: RelatedContextDTO }) => {
    setDocs((list) => list.map((d) => (d.id === res.document.id ? summaryOf(res.document) : d)));
    setActiveDoc((cur) => (cur?.id === res.document.id ? res.document : cur));
    setContext((cur) => (cur?.activeDocId === res.document.id || !cur ? res.context : cur));
  }, []);

  const openDoc = async (id: string) => {
    setSheet(null);
    setView('notes');
    if (id === activeDoc?.id) return;
    const res = await run(getDocumentAction({ documentId: id }));
    if (res) {
      setActiveDoc(res.document);
      setContext(res.context);
      setFreshDocId(null);
    }
  };

  const createDoc = async (title = 'Catatan Baru') => {
    const res = await run(
      createDocumentAction({
        workspaceId: workspace.id,
        title,
        content: '',
        projectName: projectFilter && docs.some((d) => d.projectName === projectFilter) ? projectFilter : DEFAULT_PROJECT,
      }),
      'Dokumen baru dibuat.'
    );
    if (!res) return;
    setDocs((list) => [summaryOf(res.document), ...list]);
    setActiveDoc(res.document);
    setContext(res.context);
    setFreshDocId(res.document.id);
    setShowArchived(false);
    setSheet(null);
    setView('notes');
  };

  const archiveDoc = async (archived: boolean) => {
    if (!activeDoc) return;
    const res = await run(updateDocumentAction({ documentId: activeDoc.id, isArchived: archived }), archived ? 'Dokumen diarsipkan.' : 'Dokumen dipulihkan.');
    if (res) applyDocResult(res);
  };

  const deleteDoc = async () => {
    if (!activeDoc || !confirm(`Hapus permanen "${activeDoc.title}"? Tugas yang tertaut tetap ada tanpa dokumen asal.`)) return;
    const ok = await run(deleteDocumentAction({ documentId: activeDoc.id, hard: true }), 'Dokumen dihapus permanen.');
    if (!ok) return;
    const remaining = docs.filter((d) => d.id !== activeDoc.id);
    setDocs(remaining);
    setTasks((list) => list.map((t) => (t.documentId === activeDoc.id ? { ...t, documentId: null } : t)));
    setActiveDoc(null);
    setContext(null);
    const next = remaining.find((d) => !d.isArchived);
    if (next) void openDoc(next.id);
  };

  // Append a [[wikilink]] to the active document (context panel "HUBUNGKAN_DOKUMEN")
  const linkDoc = async (r: SearchResultDTO) => {
    if (!activeDoc || r.type !== 'note' || r.id === activeDoc.id) return;
    const content = `${activeDoc.content.trimEnd()}\n\nLihat juga: [[${r.title}]]\n`;
    const res = await run(updateDocumentAction({ documentId: activeDoc.id, content }), `Ditautkan ke [[${r.title}]].`);
    if (res) {
      applyDocResult(res);
      // shortcut: remounting drops unsaved keystrokes typed in the last 3s; fine for a rare action
      setFreshDocId(null);
      setEditorRev((r) => r + 1);
    }
  };

  const onSearchSelect = (r: SearchResultDTO) => {
    if (search === 'link') return void linkDoc(r);
    if (r.type === 'note') void openDoc(r.id);
    else if (r.type === 'project') {
      setProjectFilter(r.id);
      setView('kanban');
    } else {
      const task = tasks.find((t) => t.id === r.id);
      if (task) setTaskModal({ task });
    }
  };

  // ---------- Tasks (optimistic, rolled back on failure) ----------

  const replaceTask = (task: TaskDTO) => setTasks((list) => list.map((t) => (t.id === task.id ? task : t)));

  const changeStatus = async (task: TaskDTO, next: TaskStatus) => {
    if (!canEdit) return;
    replaceTask({ ...task, status: next });
    const saved = await run(updateTaskAction({ taskId: task.id, status: next }));
    replaceTask(saved ?? task);
  };

  const submitTask = async (values: TaskFormValues) => {
    const editing = taskModal?.task;
    const saved = editing
      ? await run(updateTaskAction({ taskId: editing.id, ...values }), 'Tugas diperbarui.')
      : await run(createTaskAction({ workspaceId: workspace.id, ...values }), 'Tugas dibuat.');
    if (!saved) return false;
    setTasks((list) => (editing ? list.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...list]));
    return true;
  };

  const removeTask = async (task: TaskDTO) => {
    const ok = await run(deleteTaskAction({ taskId: task.id }), 'Tugas dihapus.');
    if (ok) setTasks((list) => list.filter((t) => t.id !== task.id));
    return !!ok;
  };

  const changeRole = async (next: Role | null) => {
    const res = await run(setRolePreviewAction({ workspaceId: workspace.id, role: next === initialData.role ? null : next }));
    if (res) setRole(res.effectiveRole);
  };

  // ---------- Render ----------

  const linkedTasks = activeDoc ? tasks.filter((t) => t.documentId === activeDoc.id) : [];
  const boardTasks = projectFilter
    ? tasks.filter((t) => t.documentId && docs.find((d) => d.id === t.documentId)?.projectName === projectFilter)
    : tasks;
  const tagNames = [...new Set(docs.flatMap((d) => d.tags))].sort();

  const sidebar = (
    <Sidebar
      docs={docs}
      tasksCount={tasks.length}
      activeDocId={activeDoc?.id ?? null}
      view={view}
      projectFilter={projectFilter}
      tagFilter={tagFilter}
      showArchived={showArchived}
      canEdit={canEdit}
      status={status}
      onProjectFilter={setProjectFilter}
      onTagFilter={setTagFilter}
      onToggleArchived={() => setShowArchived((s) => !s)}
      onOpenDoc={openDoc}
      onNewDoc={() => createDoc()}
      onShowNotes={() => {
        setView('notes');
        setSheet(null);
      }}
      onShowKanban={() => {
        setView('kanban');
        setSheet(null);
      }}
    />
  );

  const contextPanel = (
    <ContextPanel
      context={context}
      linkedTasks={linkedTasks}
      aiLabel={status.ai.engine}
      canEdit={canEdit && !!activeDoc && !activeDoc.isArchived}
      onOpenDoc={openDoc}
      onOpenTask={(task) => setTaskModal({ task })}
      onLinkDoc={() => setSearch('link')}
    />
  );

  return (
    <div className="flex-1 flex flex-col h-screen relative z-10">
      <Navbar
        workspace={workspace}
        workspaces={initialData.workspaces}
        me={me}
        role={initialData.role}
        effectiveRole={role}
        onRoleChange={changeRole}
        view={view}
        onViewChange={setView}
        onOpenSearch={() => setSearch('search')}
      />
      <ViewerBanner isVisible={role === 'Viewer'} canRestore={atLeast(initialData.role, 'Editor')} onRestore={() => changeRole(null)} />

      <div className="flex-1 flex overflow-hidden relative">
        <aside className="w-64 border-r-3 border-[var(--border-hard)] bg-[var(--bg-surface)] shrink-0 hidden md:flex flex-col" aria-label="Direktori pengetahuan">
          {sidebar}
        </aside>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {view === 'kanban' ? (
            <KanbanBoard
              tasks={boardTasks}
              docs={docs}
              meId={me.id}
              canEdit={canEdit}
              projectFilter={projectFilter}
              onClearFilter={() => setProjectFilter(null)}
              onStatusChange={changeStatus}
              onCycle={(t) => changeStatus(t, NEXT_STATUS[t.status])}
              onOpenTask={(task) => setTaskModal({ task })}
              onNewTask={(s) => setTaskModal({ task: null, defaults: { status: s } })}
              onOpenDoc={openDoc}
              onReturnToEditor={() => setView('notes')}
            />
          ) : activeDoc ? (
            <EditorView
              key={`${activeDoc.id}:${editorRev}`}
              doc={activeDoc}
              docs={docs}
              linkedTasks={linkedTasks}
              members={members}
              role={role}
              meId={me.id}
              aiLabel={status.ai.engine}
              startEditing={activeDoc.id === freshDocId}
              onSaved={applyDocResult}
              onOpenDoc={openDoc}
              onCreateDoc={(title) => createDoc(title)}
              onOpenAiExtract={() => setAiOpen(true)}
              onCycleTask={(t) => changeStatus(t, NEXT_STATUS[t.status])}
              onOpenTask={(task) => setTaskModal({ task })}
              onNewTask={() => setTaskModal({ task: null, defaults: { documentId: activeDoc.id } })}
              onArchive={archiveDoc}
              onDelete={deleteDoc}
              onOpenContext={() => setSheet('context')}
            />
          ) : (
            // Empty state (SDD 7)
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="max-w-md w-full border-3 border-[var(--border-hard)] bg-[var(--bg-surface)] shadow-[var(--solid-shadow)] p-6 space-y-4 text-center">
                <div className="font-mono text-xs font-bold text-ink-pink">// EMPTY_WORKSPACE</div>
                <h1 className="font-display font-black text-2xl uppercase text-[var(--text-main)]">Belum ada catatan</h1>
                <p className="text-sm text-[var(--text-sub)]">
                  Mulai dengan notula rapat atau spesifikasi. Tautkan dokumen dengan [[wikilink]] dan ubah action item menjadi tugas Kanban.
                </p>
                {canEdit ? (
                  <Button variant="holographic" size="lg" onClick={() => createDoc()}>
                    <Plus className="w-4 h-4" /> [+ BUAT CATATAN PERTAMA]
                  </Button>
                ) : (
                  <p className="font-mono text-xs text-[var(--text-muted)]">Viewer tidak dapat membuat catatan.</p>
                )}
              </div>
            </div>
          )}
        </main>

        {view === 'notes' && (
          <aside className="w-80 border-l-3 border-[var(--border-hard)] bg-[var(--bg-surface)] shrink-0 hidden xl:flex flex-col" aria-label="Konteks terkait">
            {contextPanel}
          </aside>
        )}
      </div>

      <MobileNav currentView={view} onViewChange={setView} onOpenSearch={() => setSearch('search')} onOpenDocs={() => setSheet('docs')} />

      <Sheet open={sheet === 'docs'} onClose={() => setSheet(null)} side="left" label="Direktori dokumen">
        {sidebar}
      </Sheet>
      <Sheet open={sheet === 'context'} onClose={() => setSheet(null)} side="right" label="Konteks terkait">
        {contextPanel}
      </Sheet>

      <SearchModal open={search !== null} mode={search ?? 'search'} workspaceId={workspace.id} tags={tagNames} onClose={() => setSearch(null)} onSelect={onSearchSelect} />
      <AiExtractModal
        open={aiOpen}
        documentId={activeDoc?.id ?? null}
        workspaceId={workspace.id}
        members={members}
        aiLabel={status.ai.engine}
        onClose={() => setAiOpen(false)}
        onCommitted={(created) => setTasks((list) => [...created, ...list])}
      />
      <TaskModal
        open={taskModal !== null}
        task={taskModal?.task ?? null}
        defaults={taskModal?.defaults}
        members={members}
        docs={docs}
        canEdit={canEdit}
        onClose={() => setTaskModal(null)}
        onSubmit={submitTask}
        onDelete={removeTask}
      />
    </div>
  );
}
