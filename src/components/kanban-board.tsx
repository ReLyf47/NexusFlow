'use client';

import * as React from 'react';
import { ArrowLeft, CheckCircle2, Clock, Inbox, LayoutGrid, List, PlayCircle, Plus, User } from 'lucide-react';
import { StatusIcon } from '@/components/editor-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  formatDue,
  isOverdue,
  PRIORITY_ORDER,
  STATUS_LABEL,
  TASK_STATUSES,
  type DocSummaryDTO,
  type TaskDTO,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/domain';
import { cn } from '@/lib/utils';

interface KanbanBoardProps {
  tasks: TaskDTO[];
  docs: DocSummaryDTO[];
  meId: string;
  canEdit: boolean;
  projectFilter: string | null;
  onClearFilter: () => void;
  onStatusChange: (task: TaskDTO, status: TaskStatus) => void;
  onCycle: (task: TaskDTO) => void;
  onOpenTask: (task: TaskDTO) => void;
  onNewTask: (status?: TaskStatus) => void;
  onOpenDoc: (id: string) => void;
  onReturnToEditor: () => void;
}

const COLUMNS: { key: TaskStatus; label: string; icon: typeof Inbox; color: string }[] = [
  { key: 'backlog', label: '01 // BACKLOG', icon: Inbox, color: 'text-[var(--text-sub)]' },
  { key: 'todo', label: '02 // TO_DO', icon: Clock, color: 'text-ink-orange' },
  { key: 'in_progress', label: '03 // IN_PROGRESS', icon: PlayCircle, color: 'text-ink-cyan' },
  { key: 'done', label: '04 // SELESAI', icon: CheckCircle2, color: 'text-ink-mint' },
];

const priorityVariant = (p: TaskPriority) => (p === 'urgent' ? 'hazard' : p === 'high' ? 'urgent' : p === 'medium' ? 'dream' : 'dream');

const byPriority = (a: TaskDTO, b: TaskDTO) =>
  PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');

export function KanbanBoard(p: KanbanBoardProps) {
  const [layout, setLayout] = React.useState<'board' | 'list'>('board');
  const [mine, setMine] = React.useState(false);
  const [dropTarget, setDropTarget] = React.useState<TaskStatus | null>(null);
  const docTitle = React.useMemo(() => new Map(p.docs.map((d) => [d.id, d.title])), [p.docs]);
  const visible = p.tasks.filter((t) => !mine || t.assigneeId === p.meId);

  const onDrop = (status: TaskStatus, e: React.DragEvent) => {
    e.preventDefault();
    setDropTarget(null);
    const task = p.tasks.find((t) => t.id === e.dataTransfer.getData('text/plain'));
    if (task && task.status !== status) p.onStatusChange(task, status);
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto pb-24 sm:pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <div className="font-mono text-xs font-bold text-ink-pink uppercase tracking-wider">// KANBAN_MATRIX</div>
          <h1 className="text-xl sm:text-2xl font-display font-black uppercase text-[var(--text-main)]">
            {p.projectFilter ?? 'Semua Proyek'} — Kanban
          </h1>
          <p className="font-mono text-xs text-[var(--text-sub)]">
            Seluruh tiket terhubung dengan dokumen asal (originDocId).
            {p.projectFilter && (
              <button onClick={p.onClearFilter} className="ml-2 underline underline-offset-2 text-[var(--text-main)]">
                [hapus filter]
              </button>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex border-2.5 border-[var(--border-hard)] bg-[var(--bg-canvas)] p-0.5" role="group" aria-label="Tata letak">
            {(['board', 'list'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLayout(l)}
                aria-pressed={layout === l}
                className={cn('px-2 py-1 font-mono text-[11px] font-bold flex items-center gap-1', layout === l ? 'bg-[var(--border-hard)] text-[var(--bg-surface)]' : 'text-[var(--text-sub)]')}
              >
                {l === 'board' ? <LayoutGrid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
                {l === 'board' ? 'BOARD' : 'LIST'}
              </button>
            ))}
          </div>
          <Button variant={mine ? 'holographic' : 'outline'} size="sm" onClick={() => setMine((m) => !m)} aria-pressed={mine}>
            <User className="w-3.5 h-3.5" /> TUGAS_SAYA
          </Button>
          {p.canEdit && (
            <Button size="sm" onClick={() => p.onNewTask()}>
              <Plus className="w-3.5 h-3.5" /> TUGAS_BARU
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={p.onReturnToEditor} className="hidden sm:inline-flex">
            <ArrowLeft className="w-3.5 h-3.5" /> EDITOR
          </Button>
        </div>
      </div>

      {layout === 'board' ? (
        // Mobile: horizontal snap-scroll of columns; desktop: grid
        <div className="flex md:grid md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 overflow-x-auto md:overflow-visible snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 pb-2">
          {COLUMNS.map((col) => {
            const colTasks = visible.filter((t) => t.status === col.key).sort(byPriority);
            const Icon = col.icon;
            return (
              <section
                key={col.key}
                aria-label={col.label}
                onDragOver={(e) => {
                  if (!p.canEdit) return;
                  e.preventDefault();
                  setDropTarget(col.key);
                }}
                onDragLeave={() => setDropTarget((d) => (d === col.key ? null : d))}
                onDrop={(e) => onDrop(col.key, e)}
                className={cn(
                  'snap-start shrink-0 w-[82vw] max-w-sm md:w-auto md:max-w-none border-3 border-[var(--border-hard)] bg-[var(--bg-surface)] shadow-[var(--solid-shadow)] p-4 flex flex-col gap-3 min-h-[240px] transition-colors',
                  dropTarget === col.key && 'bg-[var(--bg-surface-elevated)] outline outline-[3px] outline-dashed outline-offset-2 outline-[var(--ink-pink)]'
                )}
              >
                <div className={cn('flex items-center justify-between border-b-2 border-[var(--border-hard)] pb-2 font-mono font-bold text-xs', col.color)}>
                  <span className="flex items-center gap-1.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    {col.label}
                  </span>
                  <Badge variant="brutal" className="text-[9px]">
                    {colTasks.length}
                  </Badge>
                </div>
                {colTasks.length === 0 && (
                  <div className="p-4 border-2 border-dashed border-[var(--border-hard)] text-center font-mono text-[11px] text-[var(--text-muted)]">
                    {p.canEdit ? 'Seret kartu ke sini.' : 'Tidak ada tiket.'}
                  </div>
                )}
                {colTasks.map((task) => (
                  <TaskCard key={task.id} task={task} docTitle={task.documentId ? docTitle.get(task.documentId) : undefined} {...p} />
                ))}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="border-3 border-[var(--border-hard)] bg-[var(--bg-surface)] shadow-[var(--solid-shadow)] overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b-3 border-[var(--border-hard)] text-left text-[10px] uppercase text-[var(--text-muted)]">
                <th className="p-3">Status</th>
                <th className="p-3">Tugas</th>
                <th className="p-3">Prioritas</th>
                <th className="p-3">PIC</th>
                <th className="p-3">Tenggat</th>
                <th className="p-3">Dokumen</th>
              </tr>
            </thead>
            <tbody>
              {[...visible]
                .sort((a, b) => TASK_STATUSES.indexOf(a.status) - TASK_STATUSES.indexOf(b.status) || byPriority(a, b))
                .map((task) => (
                  <tr key={task.id} className="border-b-2 border-[var(--border-hard)] last:border-0">
                    <td className="p-3">
                      <button
                        onClick={() => p.onCycle(task)}
                        disabled={!p.canEdit}
                        aria-label={`Status ${STATUS_LABEL[task.status]} — klik untuk ganti`}
                        className="flex items-center gap-1.5 font-bold text-[var(--text-main)] disabled:cursor-not-allowed"
                      >
                        <StatusIcon status={task.status} />
                        <span className="hidden sm:inline">{STATUS_LABEL[task.status]}</span>
                      </button>
                    </td>
                    <td className="p-3">
                      <button onClick={() => p.onOpenTask(task)} className={cn('text-left font-bold text-[var(--text-main)] hover:underline', task.status === 'done' && 'line-through text-[var(--text-muted)]')}>
                        {task.title}
                      </button>
                    </td>
                    <td className="p-3">
                      <Badge variant={priorityVariant(task.priority)} className="text-[9px]">
                        {task.priority}
                      </Badge>
                    </td>
                    <td className="p-3 text-[var(--text-sub)]">{task.assigneeName ?? '—'}</td>
                    <td className={cn('p-3 font-bold', isOverdue(task) ? 'text-ink-pink' : 'text-[var(--text-sub)]')}>{task.dueDate ? formatDue(task.dueDate) : '—'}</td>
                    <td className="p-3">
                      {task.documentId && docTitle.get(task.documentId) ? (
                        <button onClick={() => p.onOpenDoc(task.documentId!)} className="text-ink-pink font-bold hover:underline truncate max-w-[180px] block">
                          {docTitle.get(task.documentId)}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              {!visible.length && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[var(--text-muted)]">
                    Belum ada tugas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, docTitle, canEdit, onCycle, onOpenTask, onOpenDoc }: { task: TaskDTO; docTitle?: string } & KanbanBoardProps) {
  const done = task.status === 'done';
  return (
    <article
      draggable={canEdit}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={cn(
        'p-3 border-2 border-[var(--border-hard)] bg-[var(--bg-surface-elevated)] space-y-2 text-xs shadow-[2px_2px_0px_var(--border-hard)] transition-all',
        canEdit && 'cursor-grab active:cursor-grabbing hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0px_var(--border-hard)]'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge variant={priorityVariant(task.priority)} className="text-[9px]">
            {task.priority}
          </Badge>
          {task.extractedByAi && <span className="text-[9px] font-mono font-bold text-ink-purple">[AI_EXTRACT]</span>}
        </div>
        <button
          onClick={() => onCycle(task)}
          disabled={!canEdit}
          aria-label={`Status ${STATUS_LABEL[task.status]} — klik untuk ganti`}
          className="disabled:cursor-not-allowed hover:scale-110 transition-transform"
        >
          <StatusIcon status={task.status} />
        </button>
      </div>
      <button onClick={() => onOpenTask(task)} className={cn('block text-left font-mono font-bold text-[var(--text-main)] hover:underline', done && 'line-through text-[var(--text-muted)]')}>
        {task.title}
      </button>
      {docTitle && (
        <button onClick={() => onOpenDoc(task.documentId!)} className="block text-[9px] font-mono font-bold text-ink-pink truncate max-w-full hover:underline">
          REF: {docTitle}
        </button>
      )}
      <div className="text-[10px] font-mono text-[var(--text-muted)] flex items-center justify-between pt-2 border-t border-[var(--border-hard)]">
        <span className="truncate">{task.assigneeName ?? 'Unassigned'}</span>
        {done ? (
          <span className="text-ink-mint font-bold">Selesai</span>
        ) : task.dueDate ? (
          <span className={cn('font-bold', isOverdue(task) ? 'text-ink-pink' : 'text-ink-orange')}>
            {isOverdue(task) ? 'LEWAT · ' : ''}
            {formatDue(task.dueDate)}
          </span>
        ) : null}
      </div>
    </article>
  );
}
