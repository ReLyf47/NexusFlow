'use client';

import { Archive, Cpu, Database, FileText, Kanban, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { tagColor, type DocSummaryDTO } from '@/lib/domain';
import { cn } from '@/lib/utils';

export interface EngineStatus {
  db: { state: 'up' | 'down' | 'unknown'; latencyMs?: number };
  ai: { engine: string; online: boolean | null };
}

interface SidebarProps {
  docs: DocSummaryDTO[];
  tasksCount: number;
  activeDocId: string | null;
  view: 'notes' | 'kanban';
  projectFilter: string | null;
  tagFilter: string | null;
  showArchived: boolean;
  canEdit: boolean;
  status: EngineStatus;
  onProjectFilter: (p: string | null) => void;
  onTagFilter: (t: string | null) => void;
  onToggleArchived: () => void;
  onOpenDoc: (id: string) => void;
  onNewDoc: () => void;
  onShowNotes: () => void;
  onShowKanban: () => void;
}

const sectionLabel = 'font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase px-1';

const countBy = (values: string[]) => {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

export function Sidebar(p: SidebarProps) {
  const live = p.docs.filter((d) => !d.isArchived);
  const archivedCount = p.docs.length - live.length;
  const projects = countBy(live.map((d) => d.projectName));
  const tags = countBy(live.flatMap((d) => d.tags));
  const visible = (p.showArchived ? p.docs.filter((d) => d.isArchived) : live).filter(
    (d) => (!p.projectFilter || d.projectName === p.projectFilter) && (!p.tagFilter || d.tags.includes(p.tagFilter))
  );

  return (
    <div className="flex flex-col justify-between h-full text-xs select-none">
      <div className="p-4 space-y-5 overflow-y-auto">
        {/* Directory */}
        <nav className="space-y-1.5" aria-label="Direktori">
          <div className={sectionLabel}>// DIRECTORY_ROOT</div>
          <button
            onClick={p.onShowNotes}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 border-2.5 font-mono font-bold transition-all',
              p.view === 'notes'
                ? 'border-[var(--border-hard)] bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-[var(--solid-shadow-sm)]'
                : 'border-transparent text-[var(--text-sub)] hover:border-[var(--border-hard)]'
            )}
          >
            <span className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-ink-pink" />
              Semua Dokumen
            </span>
            <Badge variant="dream" className="text-[9px]">
              {live.length}
            </Badge>
          </button>
          <button
            onClick={p.onShowKanban}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 border-2.5 font-mono font-bold transition-all',
              p.view === 'kanban'
                ? 'border-[var(--border-hard)] bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-[var(--solid-shadow-sm)]'
                : 'border-transparent text-[var(--text-sub)] hover:border-[var(--border-hard)]'
            )}
          >
            <span className="flex items-center gap-2">
              <Kanban className="w-3.5 h-3.5" />
              Papan Kanban
            </span>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">{p.tasksCount}</span>
          </button>
        </nav>

        {/* Projects */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className={cn(sectionLabel, 'px-0')}>// ACTIVE_PROJECTS</span>
            <span className="text-[9px] font-mono text-[var(--text-muted)]">[{String(projects.length).padStart(2, '0')}]</span>
          </div>
          {projects.map(([name, count]) => {
            const active = p.projectFilter === name;
            return (
              <button
                key={name}
                onClick={() => p.onProjectFilter(active ? null : name)}
                aria-pressed={active}
                className={cn(
                  'w-full p-2 border-2 font-mono text-left flex items-center justify-between gap-2 transition',
                  active
                    ? 'border-[var(--border-hard)] bg-[var(--bg-surface-elevated)] shadow-[2px_2px_0px_var(--border-hard)] text-[var(--text-main)] font-bold'
                    : 'border-transparent text-[var(--text-sub)] hover:border-[var(--border-hard)] hover:text-[var(--text-main)]'
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 shrink-0 rounded-full border border-[var(--border-hard)]" style={{ background: tagColor(name) }} />
                  <span className="truncate">{name}</span>
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Documents */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className={cn(sectionLabel, 'px-0')}>{p.showArchived ? '// ARCHIVED_DOCS' : '// RECENT_DOCS'}</span>
            <div className="flex items-center gap-1">
              {archivedCount > 0 && (
                <button
                  onClick={p.onToggleArchived}
                  aria-pressed={p.showArchived}
                  title={p.showArchived ? 'Tampilkan dokumen aktif' : `Tampilkan arsip (${archivedCount})`}
                  className="p-1 text-[var(--text-sub)] hover:text-ink-pink"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
              )}
              {p.canEdit && (
                <button onClick={p.onNewDoc} title="Dokumen baru" aria-label="Buat dokumen baru" className="p-1 text-[var(--text-main)] hover:text-ink-pink">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          {(p.projectFilter || p.tagFilter) && (
            <button
              onClick={() => {
                p.onProjectFilter(null);
                p.onTagFilter(null);
              }}
              className="w-full flex items-center justify-between px-2 py-1 border-2 border-dashed border-[var(--border-hard)] font-mono text-[10px] text-[var(--text-sub)]"
            >
              <span className="truncate">FILTER: {[p.projectFilter, p.tagFilter && `#${p.tagFilter}`].filter(Boolean).join(' · ')}</span>
              <X className="w-3 h-3 shrink-0" />
            </button>
          )}
          <div className="space-y-1 font-mono">
            {visible.length === 0 && <div className="px-2 py-3 text-[11px] text-[var(--text-muted)]">Tidak ada dokumen.</div>}
            {visible.map((doc) => {
              const active = doc.id === p.activeDocId;
              return (
                <button
                  key={doc.id}
                  onClick={() => p.onOpenDoc(doc.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'w-full p-2 flex items-center gap-2 text-left transition-all border-2',
                    active
                      ? 'border-[var(--border-hard)] border-l-4 border-l-accent-pink bg-[var(--bg-surface-elevated)] shadow-[2px_2px_0px_var(--border-hard)] font-bold text-[var(--text-main)]'
                      : 'border-transparent hover:border-[var(--border-hard)] text-[var(--text-sub)] hover:text-[var(--text-main)]',
                    doc.isArchived && 'italic'
                  )}
                >
                  <FileText className={cn('w-3.5 h-3.5 shrink-0', active ? 'text-ink-pink' : 'text-[var(--text-muted)]')} />
                  <span className="truncate">{doc.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="space-y-2">
            <div className={sectionLabel}>// TAGS_INDEX</div>
            <div className="flex flex-wrap gap-1.5 px-1">
              {tags.map(([name, count]) => {
                const active = p.tagFilter === name;
                return (
                  <button
                    key={name}
                    onClick={() => p.onTagFilter(active ? null : name)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 border-2 border-[var(--border-hard)] font-mono text-[10px] font-bold transition',
                      active ? 'bg-[var(--border-hard)] text-[var(--bg-surface)]' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-[2px_2px_0px_var(--border-hard)]'
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full border border-[var(--border-hard)]" style={{ background: tagColor(name) }} />#{name}
                    <span className="opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Engine status footer — real health checks, refreshed periodically */}
      <div className="p-3 border-t-3 border-[var(--border-hard)] bg-[var(--bg-surface-elevated)] font-mono text-[11px] space-y-1 text-[var(--text-sub)]">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" />
            MARIADB_POOL
          </span>
          <span className={cn('text-[10px] font-bold', p.status.db.state === 'up' ? 'text-ink-mint' : p.status.db.state === 'down' ? 'text-ink-pink' : 'text-[var(--text-muted)]')}>
            {p.status.db.state === 'up' ? `CONNECTED${p.status.db.latencyMs !== undefined ? ` · ${p.status.db.latencyMs}MS` : ''}` : p.status.db.state === 'down' ? 'OFFLINE' : 'CHECKING…'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 min-w-0">
            <Cpu className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{p.status.ai.engine}</span>
          </span>
          <span className={cn('text-[10px] font-bold shrink-0', p.status.ai.online ? 'text-ink-cyan' : p.status.ai.online === false ? 'text-ink-pink' : 'text-[var(--text-muted)]')}>
            {p.status.ai.online ? 'ONLINE' : p.status.ai.online === false ? 'OFFLINE' : 'CHECKING…'}
          </span>
        </div>
      </div>
    </div>
  );
}
