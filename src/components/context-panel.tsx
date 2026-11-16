'use client';

import { Compass, Link2 } from 'lucide-react';
import { StatusIcon } from '@/components/editor-view';
import { Badge } from '@/components/ui/badge';
import type { RelatedContextDTO, RelatedDocDTO, TaskDTO } from '@/lib/domain';
import { cn } from '@/lib/utils';

interface ContextPanelProps {
  context: RelatedContextDTO | null;
  linkedTasks: TaskDTO[];
  aiLabel: string;
  canEdit: boolean;
  onOpenDoc: (id: string) => void;
  onOpenTask: (task: TaskDTO) => void;
  onLinkDoc: () => void;
}

const label = 'text-[10px] font-bold tracking-wider text-[var(--text-muted)] uppercase';
const card =
  'w-full text-left p-2.5 border-2 border-[var(--border-hard)] bg-[var(--bg-surface-elevated)] shadow-[2px_2px_0px_var(--border-hard)] hover:-translate-x-px hover:-translate-y-px transition-all';

// SDD 6.1 badge colours: >= 0.90 cyan, 0.70-0.89 lavender
const matchClass = (score: number) =>
  score >= 0.9 ? 'text-ink-cyan' : score >= 0.7 ? 'text-ink-purple' : 'text-[var(--text-sub)]';

function RelatedCard({ doc, detail, onOpen }: { doc: RelatedDocDTO; detail: string; onOpen: (id: string) => void }) {
  return (
    <button className={card} onClick={() => onOpen(doc.id)}>
      <div className="font-bold text-xs text-[var(--text-main)] truncate">{doc.title}</div>
      <div className="text-[10px] text-[var(--text-muted)] flex items-center justify-between gap-2 mt-1">
        <span className="truncate">{detail}</span>
        <span className={cn('font-bold shrink-0', matchClass(doc.score))}>{Math.round(doc.score * 100)}% MATCH</span>
      </div>
    </button>
  );
}

export function ContextPanel({ context, linkedTasks, aiLabel, canEdit, onOpenDoc, onOpenTask, onLinkDoc }: ContextPanelProps) {
  const active = linkedTasks.filter((t) => t.status !== 'done');
  const empty = !context || (!context.ranked.length && !context.backlinks.length && !context.outbound.length);

  return (
    <div className="flex flex-col h-full text-xs select-none">
      <div className="px-4 py-4 border-b-3 border-[var(--border-hard)] flex items-center justify-between gap-2 bg-[var(--bg-surface-elevated)] pr-12 xl:pr-4">
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="w-4 h-4 text-ink-pink shrink-0" />
          <h2 className="font-display font-black text-[11px] uppercase text-[var(--text-main)]">KONTEKS_TERTAUT</h2>
        </div>
        <Badge variant="live" className="text-[9px] shrink-0">
          {context?.stats.activeConnections ?? 0} AKTIF
        </Badge>
      </div>

      <div className="p-4 space-y-5 overflow-y-auto flex-1 font-mono">
        {!context && <p className="text-[var(--text-muted)]">Buka dokumen untuk melihat konteks terkait.</p>}
        {context && empty && (
          <p className="text-[var(--text-muted)] leading-relaxed">
            Belum ada konteks terkait. Tambahkan proyek, tag yang sama, atau [[wikilink]] ke dokumen lain.
          </p>
        )}

        {!!context?.sameProjectDocs.length && (
          <section className="space-y-2">
            <h3 className={label}>// SAME_PROJECT ({context.sameProjectDocs.length})</h3>
            {context.sameProjectDocs.map((d) => (
              <RelatedCard key={d.id} doc={d} detail={d.projectName} onOpen={onOpenDoc} />
            ))}
          </section>
        )}

        {!!context?.sharedTagDocs.length && (
          <section className="space-y-2">
            <h3 className={label}>// SHARED_TAGS ({context.sharedTagDocs.length})</h3>
            {context.sharedTagDocs.map((d) => (
              <RelatedCard key={d.id} doc={d} detail={d.matchedTags.map((t) => `#${t}`).join(' ')} onOpen={onOpenDoc} />
            ))}
          </section>
        )}

        {!!context?.backlinks.length && (
          <section className="space-y-2">
            <h3 className={label}>// INBOUND_BACKLINKS ({context.backlinks.length})</h3>
            {context.backlinks.map((l) => (
              <button key={l.id} className={card} onClick={() => onOpenDoc(l.id)}>
                <div className="font-bold text-xs text-[var(--text-main)] truncate">{l.title}</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-1 italic truncate">menautkan ke [[{l.anchorText}]]</div>
              </button>
            ))}
          </section>
        )}

        {!!context?.outbound.length && (
          <section className="space-y-2">
            <h3 className={label}>// OUTBOUND_LINKS ({context.outbound.length})</h3>
            {context.outbound.map((l) => (
              <button key={l.id} className={card} onClick={() => onOpenDoc(l.id)}>
                <div className="font-bold text-xs text-[var(--text-main)] truncate flex items-center gap-1.5">
                  <Link2 className="w-3 h-3 shrink-0" />
                  {l.title}
                </div>
              </button>
            ))}
          </section>
        )}

        {!!active.length && (
          <section className="space-y-2">
            <h3 className={label}>// TUGAS_AKTIF ({active.length})</h3>
            {active.map((t) => (
              <button key={t.id} className={cn(card, 'flex items-center gap-2')} onClick={() => onOpenTask(t)}>
                <StatusIcon status={t.status} />
                <span className="font-bold text-[var(--text-main)] truncate">{t.title}</span>
              </button>
            ))}
          </section>
        )}

        {context && (
          <section className="p-3.5 border-2.5 border-[var(--border-hard)] bg-[var(--bg-surface-elevated)] shadow-[2px_2px_0px_var(--border-hard)] space-y-2">
            <h3 className="text-[10px] font-bold text-ink-pink uppercase tracking-widest">✦ GRAPH_TOPOLOGY</h3>
            <dl className="grid grid-cols-2 gap-2 text-[10px]">
              {[
                ['OUTBOUND', `${context.stats.outbound} Link`],
                ['BACKLINKS', `${context.stats.inbound} Rujukan`],
                ['TASKS', `${linkedTasks.length} Tugas`],
                ['ENGINE', aiLabel.split(' // ')[0]],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[var(--text-muted)] text-[9px]">{k}:</dt>
                  <dd className="text-[var(--text-main)] font-bold truncate">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>

      {canEdit && context && (
        <div className="p-3 border-t-3 border-[var(--border-hard)] bg-[var(--bg-surface-elevated)]">
          <button
            onClick={onLinkDoc}
            className="w-full py-2 border-2.5 border-[var(--border-hard)] bg-[var(--bg-surface)] shadow-[2px_2px_0px_var(--border-hard)] font-mono font-bold text-xs text-[var(--text-main)] hover:bg-[var(--border-hard)] hover:text-[var(--bg-surface)] transition-all"
          >
            [+ HUBUNGKAN_DOKUMEN]
          </button>
        </div>
      )}
    </div>
  );
}
