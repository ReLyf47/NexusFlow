'use client';

import * as React from 'react';
import { CheckCircle2, Cpu, Loader2, RotateCcw } from 'lucide-react';
import { commitExtractedTasksAction, extractActionItemsAction } from '@/actions';
import { BorderBeam } from '@/components/magicui/border-beam';
import { useRun } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TASK_PRIORITIES, type ActionItemDraftDTO, type MemberDTO, type TaskDTO, type TaskPriority } from '@/lib/domain';

interface AiExtractModalProps {
  open: boolean;
  documentId: string | null;
  workspaceId: string;
  members: MemberDTO[];
  aiLabel: string;
  onClose: () => void;
  onCommitted: (tasks: TaskDTO[]) => void;
}

type Draft = ActionItemDraftDTO & { checked: boolean };
type State = { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'review'; engine: string; drafts: Draft[] };

const input = 'border-2 border-[var(--border-hard)] bg-[var(--bg-surface)] text-[var(--text-main)] font-mono text-[11px] px-1.5 py-1';

// UI state machine (SDD 5.1): FetchingAIResult -> ReviewDraftTasks -> CommitTasks
export function AiExtractModal({ open, documentId, workspaceId, members, aiLabel, onClose, onCommitted }: AiExtractModalProps) {
  const run = useRun();
  const [state, setState] = React.useState<State>({ phase: 'loading' });
  const [committing, setCommitting] = React.useState(false);

  const extract = React.useCallback(async () => {
    if (!documentId) return;
    setState({ phase: 'loading' });
    const res = await extractActionItemsAction({ documentId }).catch(() => null);
    if (!res) return setState({ phase: 'error', message: 'Koneksi ke server terputus.' });
    if (!res.ok) return setState({ phase: 'error', message: res.error.message });
    setState({ phase: 'review', engine: res.data.engine, drafts: res.data.actionItems.map((d) => ({ ...d, checked: true })) });
  }, [documentId]);

  React.useEffect(() => {
    if (open) void extract();
  }, [open, extract]);

  const update = (i: number, patch: Partial<Draft>) =>
    setState((s) => (s.phase === 'review' ? { ...s, drafts: s.drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)) } : s));

  const selected = state.phase === 'review' ? state.drafts.filter((d) => d.checked) : [];

  const commit = async () => {
    if (!documentId || !selected.length) return;
    setCommitting(true);
    const tasks = await run(
      commitExtractedTasksAction({
        workspaceId,
        documentId,
        tasks: selected.map(({ title, description, priority, assigneeId, dueDate }) => ({ title, description, priority, assigneeId, dueDate })),
      }),
      `✓ ${selected.length} action item disinkronkan ke Kanban & originDocId.`
    );
    setCommitting(false);
    if (tasks) {
      onCommitted(tasks);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} labelledBy="ai-modal-title" className="max-w-xl">
      <BorderBeam active={state.phase === 'loading' || committing} className="shadow-[var(--dream-aura-shadow)]">
        <div className="bg-[var(--bg-surface)] p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 pb-3 border-b-3 border-[var(--border-hard)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 border-2 border-[var(--border-hard)] bg-[var(--border-hard)] text-accent-cyan dark:text-accent-pink flex items-center justify-center shadow-[2px_2px_0px_var(--border-hard)]">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 id="ai-modal-title" className="font-display font-black text-base uppercase text-[var(--text-main)]">
                  Ekstraksi Tugas Otomatis AI
                </h2>
                <p className="font-mono text-xs text-[var(--text-muted)]">
                  ENGINE: <span className="text-ink-cyan font-bold">{state.phase === 'review' ? state.engine : aiLabel}</span>
                </p>
              </div>
            </div>
            <button onClick={onClose} className="font-mono font-bold text-sm text-[var(--text-main)] hover:text-ink-pink">
              ✕ [ESC]
            </button>
          </div>

          {state.phase === 'loading' && (
            <div className="py-8 text-center font-mono text-xs text-[var(--text-sub)] space-y-2" aria-live="polite">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              <p className="font-bold">✺ MEMPROSES… Model menganalisis notula dokumen</p>
              <p className="text-[var(--text-muted)]">Batas waktu 15 detik.</p>
            </div>
          )}

          {state.phase === 'error' && (
            <div role="alert" className="border-2.5 border-[var(--border-hard)] bg-accent-yellow text-[#0A0A0C] p-4 font-mono text-xs font-bold space-y-3">
              <p>{state.message}</p>
              <Button size="sm" onClick={extract}>
                <RotateCcw className="w-3.5 h-3.5" /> COBA_LAGI
              </Button>
            </div>
          )}

          {state.phase === 'review' && (
            <>
              <p className="text-sm text-[var(--text-sub)]">
                {state.drafts.length
                  ? `Ditemukan ${state.drafts.length} action item eksplisit. Tinjau sebelum dikirim ke Kanban:`
                  : 'Tidak ditemukan action item eksplisit pada dokumen ini.'}
              </p>
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {state.drafts.map((d, i) => (
                  <div key={i} className="p-3 border-2 border-[var(--border-hard)] bg-[var(--bg-surface-elevated)] space-y-2 text-xs font-mono shadow-[2px_2px_0px_var(--border-hard)]">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={d.checked} onChange={() => update(i, { checked: !d.checked })} className="mt-0.5 w-4 h-4 accent-[var(--ink-pink)]" />
                      <span className="font-bold text-[var(--text-main)] leading-snug">{d.title}</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-2 pl-6 text-[10px] text-[var(--text-muted)]">
                      <label className="flex items-center gap-1">
                        PIC
                        <select aria-label="Penanggung jawab" className={input} value={d.assigneeId ?? ''} onChange={(e) => update(i, { assigneeId: e.target.value || null })}>
                          <option value="">{d.assigneeHint ? `? ${d.assigneeHint}` : '—'}</option>
                          {members.map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-1">
                        DUE
                        <input type="date" aria-label="Tenggat" className={input} value={d.dueDate ?? ''} onChange={(e) => update(i, { dueDate: e.target.value || null })} />
                      </label>
                      <select aria-label="Prioritas" className={input} value={d.priority} onChange={(e) => update(i, { priority: e.target.value as TaskPriority })}>
                        {TASK_PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {p.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="pt-3 border-t-3 border-[var(--border-hard)] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <span className="text-[var(--text-muted)] text-[10px]">
              Tugas otomatis mengikat <code className="text-ink-pink font-bold">originDocId</code> catatan ini.
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose} disabled={committing}>
                [BATAL]
              </Button>
              <Button variant="holographic" onClick={commit} disabled={committing || !selected.length}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                {committing ? 'MENYINKRONKAN…' : `✓ KONFIRMASI_KE_KANBAN${selected.length ? ` (${selected.length})` : ''}`}
              </Button>
            </div>
          </div>
        </div>
      </BorderBeam>
    </Dialog>
  );
}
