'use client';

import * as React from 'react';
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  Circle,
  Clock,
  Compass,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { summarizeDocumentAction, updateDocumentAction } from '@/actions';
import { MarkdownView } from '@/components/markdown-view';
import { ShimmerBadge } from '@/components/magicui/shimmer-badge';
import { useToast } from '@/components/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Menu, MenuItem } from '@/components/ui/menu';
import {
  atLeast,
  DEFAULT_PROJECT,
  formatDue,
  isOverdue,
  STATUS_LABEL,
  tagColor,
  type DocSummaryDTO,
  type DocumentDTO,
  type MemberDTO,
  type RelatedContextDTO,
  type Role,
  type TaskDTO,
} from '@/lib/domain';
import { normalizeTag } from '@/lib/markdown';
import { cn } from '@/lib/utils';

type Patch = { title?: string; content?: string; projectName?: string; tags?: string[] };
type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

const AUTOSAVE_MS = 3000; // NFR-REL-02

interface EditorViewProps {
  doc: DocumentDTO;
  docs: DocSummaryDTO[];
  linkedTasks: TaskDTO[];
  members: MemberDTO[];
  role: Role;
  meId: string;
  aiLabel: string;
  startEditing?: boolean;
  onSaved: (res: { document: DocumentDTO; context: RelatedContextDTO }) => void;
  onOpenDoc: (id: string) => void;
  onCreateDoc: (title: string) => void;
  onOpenAiExtract: () => void;
  onCycleTask: (task: TaskDTO) => void;
  onOpenTask: (task: TaskDTO) => void;
  onNewTask: () => void;
  onArchive: (archived: boolean) => void;
  onDelete: () => void;
  onOpenContext: () => void;
}

const summaryLines = (s: string | null) =>
  (s ?? '')
    .split('\n')
    .map((l) => l.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean);

export function EditorView(p: EditorViewProps) {
  const toast = useToast();
  const { doc } = p;
  const canEdit = atLeast(p.role, 'Editor') && !doc.isArchived;
  const isAdmin = p.role === 'Admin';
  const canRemove = isAdmin || (atLeast(p.role, 'Editor') && doc.authorId === p.meId);

  const [editing, setEditing] = React.useState(!!p.startEditing && canEdit);
  const [title, setTitle] = React.useState(doc.title);
  const [content, setContent] = React.useState(doc.content);
  const [tags, setTags] = React.useState(doc.tags);
  const [project, setProject] = React.useState(doc.projectName);
  const [newProject, setNewProject] = React.useState<string | null>(null);
  const [tagInput, setTagInput] = React.useState('');
  const [saveState, setSaveState] = React.useState<SaveState>('saved');
  const [summary, setSummary] = React.useState<{ state: 'idle' | 'loading' | 'done' | 'error'; bullets: string[]; message?: string; open: boolean }>({
    state: doc.summary ? 'done' : 'idle',
    bullets: summaryLines(doc.summary),
    open: false,
  });

  const pending = React.useRef<Patch | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const textarea = React.useRef<HTMLTextAreaElement>(null);
  const onSaved = React.useRef(p.onSaved);
  onSaved.current = p.onSaved;

  const flush = React.useCallback(async () => {
    clearTimeout(timer.current);
    const patch = pending.current;
    if (!patch) return;
    pending.current = null;
    setSaveState('saving');
    const res = await updateDocumentAction({ documentId: doc.id, ...patch }).catch(() => null);
    if (res?.ok) {
      onSaved.current(res.data);
      setSaveState(pending.current ? 'dirty' : 'saved');
    } else {
      // keep the unsaved changes so the retry button (or next keystroke) sends them again
      pending.current = { ...patch, ...(pending.current as Patch | null) };
      setSaveState('error');
      toast('error', res ? res.error.message : 'Gagal menyimpan: koneksi terputus.');
    }
  }, [doc.id, toast]);

  const queue = (patch: Patch, immediate = false) => {
    pending.current = { ...pending.current, ...patch };
    setSaveState('dirty');
    clearTimeout(timer.current);
    if (immediate) void flush();
    else timer.current = setTimeout(flush, AUTOSAVE_MS);
  };

  // Save anything pending when switching documents / unmounting; warn before closing the tab
  React.useEffect(() => () => void flush(), [flush]);
  React.useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const titleMap = React.useMemo(
    () => new Map(p.docs.filter((d) => !d.isArchived).map((d) => [d.title.toLowerCase(), d.id])),
    [p.docs]
  );
  const projects = React.useMemo(
    () => [...new Set([DEFAULT_PROJECT, ...p.docs.map((d) => d.projectName), project])].sort(),
    [p.docs, project]
  );

  const changeProject = (value: string) => {
    if (value === '__new__') return setNewProject('');
    setProject(value);
    queue({ projectName: value }, true);
  };

  const addTag = () => {
    const t = normalizeTag(tagInput);
    setTagInput('');
    if (!t || tags.includes(t)) return;
    const next = [...tags, t];
    setTags(next);
    queue({ tags: next }, true);
  };
  const removeTag = (t: string) => {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    queue({ tags: next }, true);
  };

  const runSummary = async () => {
    const ta = textarea.current;
    const selected = editing && ta ? content.slice(ta.selectionStart, ta.selectionEnd).trim() : '';
    setSummary((s) => ({ ...s, state: 'loading', open: true, message: undefined }));
    const res = await summarizeDocumentAction({ documentId: doc.id, text: selected || undefined, save: true }).catch(() => null);
    if (res?.ok) setSummary({ state: 'done', bullets: res.data.summary, open: true });
    else setSummary((s) => ({ ...s, state: 'error', open: true, message: res ? res.error.message : 'Koneksi ke server terputus.' }));
  };

  const insertSummary = () => {
    const block = `> **Ringkasan AI**\n${summary.bullets.map((b) => `> - ${b}`).join('\n')}\n\n`;
    const next = block + content;
    setContent(next);
    queue({ content: next }, true);
    toast('success', 'Ringkasan disisipkan di awal dokumen.');
  };

  const saveBadge: Record<SaveState, { label: string; variant: 'live' | 'urgent' | 'cyan' | 'hazard' }> = {
    saved: { label: '● TERSIMPAN', variant: 'live' },
    dirty: { label: '● BELUM_TERSIMPAN', variant: 'urgent' },
    saving: { label: '● MENYIMPAN…', variant: 'cyan' },
    error: { label: '● GAGAL_SIMPAN — ULANGI', variant: 'hazard' },
  };
  const author = p.members.find((m) => m.userId === doc.authorId)?.name ?? 'Anggota lama';

  return (
    <div className="flex-1 flex flex-col overflow-y-auto pb-20 sm:pb-0">
      <div className="px-4 sm:px-8 lg:px-12 pt-6 sm:pt-8 pb-4 max-w-4xl w-full mx-auto space-y-4">
        {/* Breadcrumbs & save status */}
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] sm:text-xs text-[var(--text-muted)] border-b-2 border-[var(--border-hard)] pb-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <span>PROJECTS</span>
            <span>/</span>
            <span className="text-[var(--text-main)] font-bold truncate max-w-[40vw] sm:max-w-none">{project.toUpperCase()}</span>
            <span>/</span>
            <span className="text-ink-pink font-bold truncate">NOTES.MD</span>
          </div>
          {atLeast(p.role, 'Editor') ? (
            saveState === 'error' ? (
              <button onClick={() => void flush()}>
                <Badge variant="hazard" className="text-[9px]">
                  {saveBadge.error.label}
                </Badge>
              </button>
            ) : (
              <Badge variant={saveBadge[saveState].variant} className="text-[9px]" aria-live="polite">
                {saveBadge[saveState].label}
              </Badge>
            )
          ) : (
            <Badge variant="urgent" className="text-[9px]">
              ● READ_ONLY
            </Badge>
          )}
        </div>

        {doc.isArchived && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-2.5 border-dashed border-[var(--border-hard)] bg-[var(--bg-surface)] px-3 py-2 font-mono text-xs font-bold text-[var(--text-main)]">
            <span className="flex items-center gap-2">
              <Archive className="w-4 h-4" /> Dokumen ini diarsipkan.
            </span>
            {canRemove && (
              <Button size="sm" variant="outline" onClick={() => p.onArchive(false)}>
                <ArchiveRestore className="w-3.5 h-3.5" /> PULIHKAN
              </Button>
            )}
          </div>
        )}

        {/* Title & chrome sticker */}
        <div className="pt-2 pb-1 space-y-2">
          <div className="flex items-center justify-end sm:justify-between gap-3">
            <span className="hidden sm:inline font-mono text-xs font-bold text-[var(--text-muted)] tracking-wider">// ACTIVE_SPEC_DOCUMENT</span>
            <ShimmerBadge className="max-w-[60%]">
              <span className="text-ink-pink font-black">✦</span>
              <span className="truncate">{p.aiLabel}</span>
            </ShimmerBadge>
          </div>
          {editing ? (
            <input
              aria-label="Judul dokumen"
              value={title}
              maxLength={255}
              onChange={(e) => {
                setTitle(e.target.value);
                if (e.target.value.trim()) queue({ title: e.target.value.trim() });
              }}
              className="w-full bg-[var(--bg-surface)] border-2.5 border-[var(--border-hard)] px-3 py-2 text-2xl sm:text-3xl font-display font-black uppercase tracking-tight text-[var(--text-main)] focus:outline-none focus-visible:shadow-[var(--solid-shadow)]"
            />
          ) : (
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-black tracking-tight leading-[1.15] uppercase text-[var(--text-main)] break-words">
              {title}
            </h1>
          )}
          <p className="font-tech font-semibold text-sm text-[var(--text-sub)]">
            Oleh {author} · diperbarui {new Date(doc.updatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>

        {/* Project, tags & actions */}
        <div className="flex flex-col gap-3 pt-2 pb-4 border-b-3 border-[var(--border-hard)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-[var(--text-muted)]">PROYEK:</span>
            {canEdit && newProject === null ? (
              <select
                aria-label="Proyek dokumen"
                value={project}
                onChange={(e) => changeProject(e.target.value)}
                className="font-mono text-xs font-bold border-2 border-[var(--border-hard)] bg-[var(--bg-surface)] text-[var(--text-main)] px-2 py-1"
              >
                {projects.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                {isAdmin && <option value="__new__">+ Proyek baru…</option>}
              </select>
            ) : newProject !== null ? (
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newProject.trim();
                  setNewProject(null);
                  if (name) changeProject(name.slice(0, 100));
                }}
              >
                <input
                  autoFocus
                  aria-label="Nama proyek baru"
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  className="font-mono text-xs border-2 border-[var(--border-hard)] bg-[var(--bg-surface)] text-[var(--text-main)] px-2 py-1"
                />
                <Button size="sm" type="submit">
                  OK
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setNewProject(null)}>
                  BATAL
                </Button>
              </form>
            ) : (
              <span className="font-mono text-xs font-bold text-[var(--text-main)]">{project}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-[var(--text-muted)] mr-1">TAGS:</span>
            {tags.map((t) => (
              <Badge key={t} variant="dream">
                <span className="w-1.5 h-1.5 rounded-full border border-[var(--border-hard)]" style={{ background: tagColor(t) }} />#{t}
                {canEdit && (
                  <button onClick={() => removeTag(t)} aria-label={`Hapus tag ${t}`} className="hover:text-ink-pink">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            ))}
            {canEdit && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addTag();
                }}
              >
                <input
                  aria-label="Tambah tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="+tag"
                  className="w-20 font-mono text-xs font-bold border-2 border-dashed border-[var(--border-hard)] bg-transparent text-[var(--text-main)] placeholder:text-[var(--text-muted)] px-2 py-0.5 focus:outline-none focus:border-solid"
                />
              </form>
            )}
            {!tags.length && !canEdit && <span className="font-mono text-xs text-[var(--text-muted)]">—</span>}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button onClick={runSummary} disabled={!canEdit || summary.state === 'loading'}>
              {summary.state === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-ink-orange" />}
              <span>{summary.state === 'loading' ? '✺ MEMPROSES…' : 'RINGKASAN_AI'}</span>
            </Button>
            <Button variant="holographic" onClick={p.onOpenAiExtract} disabled={!canEdit}>
              <Target className="w-3.5 h-3.5" />
              <span>EKSTRAK_TUGAS_AI</span>
            </Button>
            {canEdit && (
              <Button variant="outline" onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
                {editing ? <Eye className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                {editing ? 'PRATINJAU' : 'EDIT'}
              </Button>
            )}
            {!editing && summary.state === 'done' && !summary.open && (
              <Button variant="ghost" onClick={() => setSummary((s) => ({ ...s, open: true }))}>
                LIHAT_RINGKASAN
              </Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" className="xl:hidden" onClick={p.onOpenContext}>
                <Compass className="w-3.5 h-3.5" /> KONTEKS
              </Button>
              {canRemove && (
                <Menu
                  label="Aksi dokumen"
                  triggerClassName="h-9 w-9 flex items-center justify-center border-2 border-[var(--border-hard)] bg-[var(--bg-surface)] text-[var(--text-main)]"
                  trigger={<MoreHorizontal className="w-4 h-4" />}
                >
                  {doc.isArchived ? (
                    <MenuItem onClick={() => p.onArchive(false)}>
                      <ArchiveRestore className="w-3.5 h-3.5" /> Pulihkan dari arsip
                    </MenuItem>
                  ) : (
                    <MenuItem onClick={() => p.onArchive(true)}>
                      <Archive className="w-3.5 h-3.5" /> Arsipkan
                    </MenuItem>
                  )}
                  <MenuItem onClick={p.onDelete} className="text-ink-pink">
                    <Trash2 className="w-3.5 h-3.5" /> Hapus permanen
                  </MenuItem>
                </Menu>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-8 lg:px-12 pt-2 pb-16 max-w-4xl w-full mx-auto space-y-8">
        {/* AI summary box */}
        {summary.open && (
          <div className="border-3 border-[var(--border-hard)] bg-[var(--bg-surface)] shadow-[var(--dream-aura-shadow)] p-5 space-y-3" aria-live="polite">
            <div className="flex items-center justify-between gap-2 border-b-2 border-[var(--border-hard)] pb-2">
              <div className="flex items-center gap-2 font-mono font-bold text-xs uppercase text-[var(--text-main)]">
                <Sparkles className="w-4 h-4 text-ink-pink" />
                <span>AI_EXECUTIVE_SUMMARY // {p.aiLabel}</span>
              </div>
              <button onClick={() => setSummary((s) => ({ ...s, open: false }))} className="font-mono font-bold text-xs text-[var(--text-main)] hover:text-ink-pink">
                ✕ [TUTUP]
              </button>
            </div>
            {summary.state === 'loading' && (
              <p className="font-mono text-sm text-[var(--text-sub)] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Model sedang merangkum… (maks. 15 detik)
              </p>
            )}
            {summary.state === 'error' && (
              <div className="border-2.5 border-[var(--border-hard)] bg-accent-yellow text-[#0A0A0C] p-3 font-mono text-xs font-bold space-y-2">
                <p>{summary.message}</p>
                <Button size="sm" onClick={runSummary}>
                  <RotateCcw className="w-3.5 h-3.5" /> COBA_LAGI
                </Button>
              </div>
            )}
            {summary.state === 'done' && (
              <>
                <ul className="prose-nf list-none pl-0 space-y-1.5">
                  {summary.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-ink-pink font-mono font-bold">→</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                {canEdit && (
                  <Button size="sm" variant="outline" onClick={insertSummary}>
                    SISIPKAN_KE_DOKUMEN
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {/* Content */}
        <section className="border-3 border-[var(--border-hard)] bg-[var(--bg-surface)] shadow-[var(--solid-shadow-sm)]">
          {editing ? (
            <div>
              <textarea
                ref={textarea}
                aria-label="Isi dokumen (Markdown)"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  queue({ content: e.target.value });
                }}
                onBlur={() => void flush()}
                rows={22}
                spellCheck
                className="w-full min-h-[50vh] resize-y bg-transparent p-5 font-mono text-sm leading-relaxed text-[var(--text-main)] focus:outline-none"
                placeholder="# Judul bagian&#10;&#10;Tulis Markdown di sini. Gunakan [[Judul Dokumen]] untuk menautkan catatan lain."
              />
              <div className="border-t-2 border-[var(--border-hard)] px-4 py-2 font-mono text-[10px] text-[var(--text-muted)]">
                MARKDOWN · [[Judul]] = WIKILINK · AUTOSAVE 3 DETIK · PILIH TEKS LALU RINGKASAN_AI UNTUK MERANGKUM BAGIAN
              </div>
            </div>
          ) : (
            <div className="p-5 sm:p-8">
              <MarkdownView
                content={content}
                resolve={(t) => titleMap.get(t.toLowerCase()) ?? null}
                onOpenDoc={p.onOpenDoc}
                onCreateDoc={p.onCreateDoc}
                canCreate={canEdit}
              />
            </div>
          )}
        </section>

        {/* Linked origin tasks */}
        <section className="space-y-3 pt-4 border-t-3 border-[var(--border-hard)]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display font-black text-base sm:text-lg uppercase text-[var(--text-main)] flex items-center gap-2">
              TIKET TUGAS TERTAUT
              <Badge variant="brutal">{p.linkedTasks.length}</Badge>
            </h2>
            {canEdit && (
              <Button size="sm" onClick={p.onNewTask}>
                <Plus className="w-3.5 h-3.5" /> TUGAS
              </Button>
            )}
          </div>
          {p.linkedTasks.length === 0 && (
            <p className="font-mono text-xs text-[var(--text-muted)] border-2 border-dashed border-[var(--border-hard)] p-4">
              Belum ada tugas dari dokumen ini. Jalankan EKSTRAK_TUGAS_AI atau tambah tugas manual.
            </p>
          )}
          <div className="space-y-2.5">
            {p.linkedTasks.map((task) => (
              <TaskRow key={task.id} task={task} canEdit={atLeast(p.role, 'Editor')} onCycle={p.onCycleTask} onOpen={p.onOpenTask} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function StatusIcon({ status }: { status: TaskDTO['status'] }) {
  if (status === 'done') return <CheckCircle2 className="w-5 h-5 text-ink-mint" />;
  if (status === 'in_progress') return <Circle className="w-5 h-5 text-ink-cyan fill-current" />;
  return <Clock className="w-5 h-5 text-[var(--text-muted)]" />;
}

function TaskRow({ task, canEdit, onCycle, onOpen }: { task: TaskDTO; canEdit: boolean; onCycle: (t: TaskDTO) => void; onOpen: (t: TaskDTO) => void }) {
  const done = task.status === 'done';
  return (
    <div className="p-3 border-2.5 border-[var(--border-hard)] bg-[var(--bg-surface)] shadow-[2.5px_2.5px_0px_var(--border-hard)] flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => onCycle(task)}
          disabled={!canEdit}
          aria-label={`Status ${STATUS_LABEL[task.status]} — klik untuk ganti status`}
          className="shrink-0 hover:scale-110 transition-transform disabled:cursor-not-allowed disabled:opacity-60"
        >
          <StatusIcon status={task.status} />
        </button>
        <button onClick={() => onOpen(task)} className={cn('text-left text-xs sm:text-sm font-mono truncate', done ? 'line-through text-[var(--text-muted)]' : 'font-bold text-[var(--text-main)]')}>
          {task.title}
        </button>
      </div>
      <div className="flex items-center gap-2 font-mono text-[10px] shrink-0">
        {task.dueDate && (
          <span className={cn('hidden sm:inline font-bold', isOverdue(task) ? 'text-ink-pink' : 'text-ink-orange')}>{formatDue(task.dueDate)}</span>
        )}
        <Badge variant={done ? 'live' : task.status === 'in_progress' ? 'cyan' : 'dream'} className="text-[9px]">
          {STATUS_LABEL[task.status]}
        </Badge>
        <span className="font-bold text-[var(--text-sub)] hidden sm:inline max-w-[90px] truncate">{task.assigneeName?.split(' ')[0] ?? 'UNASSIGNED'}</span>
      </div>
    </div>
  );
}
