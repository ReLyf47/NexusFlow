'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type DocSummaryDTO,
  type MemberDTO,
  type TaskDTO,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/domain';

export interface TaskFormValues {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate: string | null;
  documentId: string | null;
}

interface TaskModalProps {
  open: boolean;
  task: TaskDTO | null; // null = create
  defaults?: Partial<TaskFormValues>;
  members: MemberDTO[];
  docs: DocSummaryDTO[];
  canEdit: boolean;
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => Promise<boolean>;
  onDelete: (task: TaskDTO) => Promise<boolean>;
}

const field = 'block space-y-1.5';
const labelCls = 'font-mono text-[11px] font-bold text-[var(--text-sub)] uppercase';
const select = 'w-full h-10 border-2.5 border-[var(--border-hard)] bg-[var(--bg-surface-elevated)] px-2 font-mono text-xs font-bold text-[var(--text-main)] disabled:opacity-60';

export function TaskModal({ open, task, defaults, members, docs, canEdit, onClose, onSubmit, onDelete }: TaskModalProps) {
  const initial = (): TaskFormValues => ({
    title: task?.title ?? '',
    description: task?.description ?? null,
    status: task?.status ?? defaults?.status ?? 'todo',
    priority: task?.priority ?? 'medium',
    assigneeId: task?.assigneeId ?? null,
    dueDate: task?.dueDate ?? null,
    documentId: task?.documentId ?? defaults?.documentId ?? null,
  });
  const [values, setValues] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  // reset the form whenever a different task (or a new one) is opened
  React.useEffect(() => {
    if (open) setValues(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const set = <K extends keyof TaskFormValues>(k: K, v: TaskFormValues[K]) => setValues((s) => ({ ...s, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await onSubmit({ ...values, title: values.title.trim(), description: values.description?.trim() || null });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} labelledBy="task-modal-title" className="max-w-lg">
      <form onSubmit={submit} className="border-3 border-[var(--border-hard)] bg-[var(--bg-surface)] shadow-[var(--dream-aura-shadow)] p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 pb-3 border-b-3 border-[var(--border-hard)]">
          <div>
            <h2 id="task-modal-title" className="font-display font-black text-base uppercase text-[var(--text-main)]">
              {task ? (canEdit ? 'Edit Tugas' : 'Detail Tugas') : 'Tugas Baru'}
            </h2>
            {task?.extractedByAi && <p className="font-mono text-[10px] text-ink-purple font-bold">[AI_EXTRACT] dibuat dari ekstraksi AI</p>}
          </div>
          <button type="button" onClick={onClose} className="font-mono font-bold text-sm text-[var(--text-main)] hover:text-ink-pink">
            ✕ [ESC]
          </button>
        </div>

        <fieldset disabled={!canEdit || busy} className="space-y-3">
          <label className={field}>
            <span className={labelCls}>Judul</span>
            <Input data-autofocus required minLength={2} maxLength={255} value={values.title} onChange={(e) => set('title', e.target.value)} />
          </label>
          <label className={field}>
            <span className={labelCls}>Deskripsi</span>
            <textarea
              rows={3}
              maxLength={10000}
              value={values.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              className="w-full border-2.5 border-[var(--border-hard)] bg-[var(--bg-surface-elevated)] px-3 py-2 font-sans text-sm text-[var(--text-main)] disabled:opacity-60"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={field}>
              <span className={labelCls}>Status</span>
              <select className={select} value={values.status} onChange={(e) => set('status', e.target.value as TaskStatus)}>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className={field}>
              <span className={labelCls}>Prioritas</span>
              <select className={select} value={values.priority} onChange={(e) => set('priority', e.target.value as TaskPriority)}>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className={field}>
              <span className={labelCls}>Penanggung jawab</span>
              <select className={select} value={values.assigneeId ?? ''} onChange={(e) => set('assigneeId', e.target.value || null)}>
                <option value="">— Belum ditugaskan —</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={field}>
              <span className={labelCls}>Tenggat</span>
              <Input type="date" value={values.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value || null)} />
            </label>
          </div>
          <label className={field}>
            <span className={labelCls}>Dokumen asal (originDocId)</span>
            <select className={select} value={values.documentId ?? ''} onChange={(e) => set('documentId', e.target.value || null)}>
              <option value="">— Tanpa dokumen —</option>
              {docs
                .filter((d) => !d.isArchived || d.id === values.documentId)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
            </select>
          </label>
        </fieldset>

        <div className="pt-3 border-t-3 border-[var(--border-hard)] flex items-center justify-between gap-2">
          {task && canEdit ? (
            <Button
              variant="ghost"
              className="text-ink-pink"
              disabled={busy}
              onClick={async () => {
                if (!confirm(`Hapus tugas "${task.title}"?`)) return;
                setBusy(true);
                if (await onDelete(task)) onClose();
                setBusy(false);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" /> HAPUS
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              {canEdit ? '[BATAL]' : '[TUTUP]'}
            </Button>
            {canEdit && (
              <Button type="submit" variant="holographic" disabled={busy}>
                {busy ? 'MENYIMPAN…' : task ? 'SIMPAN' : 'BUAT_TUGAS'}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Dialog>
  );
}
