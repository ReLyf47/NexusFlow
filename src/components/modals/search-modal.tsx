'use client';

import * as React from 'react';
import { Loader2, Search } from 'lucide-react';
import { searchWorkspaceAction } from '@/actions';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { STATUS_LABEL, TASK_STATUSES, type SearchResultDTO, type SearchType, type TaskStatus } from '@/lib/domain';
import { cn } from '@/lib/utils';

interface SearchModalProps {
  open: boolean;
  mode: 'search' | 'link'; // link = pick a note to insert as [[wikilink]]
  workspaceId: string;
  tags: string[];
  onClose: () => void;
  onSelect: (result: SearchResultDTO) => void;
}

const TABS: { key: SearchType; label: string }[] = [
  { key: 'all', label: 'SEMUA_ENTITAS' },
  { key: 'notes', label: 'CATATAN' },
  { key: 'tasks', label: 'TUGAS' },
  { key: 'projects', label: 'PROYEK' },
];

const BADGE = { note: 'cyan', task: 'urgent', project: 'live' } as const;
const filterSelect = 'border-2 border-[var(--border-hard)] bg-[var(--bg-surface)] font-mono text-[10px] font-bold text-[var(--text-main)] px-1.5 py-1';

export function SearchModal({ open, mode, workspaceId, tags, onClose, onSelect }: SearchModalProps) {
  const [query, setQuery] = React.useState('');
  const [type, setType] = React.useState<SearchType>('all');
  const [tag, setTag] = React.useState('');
  const [status, setStatus] = React.useState<TaskStatus | ''>('');
  const [results, setResults] = React.useState<SearchResultDTO[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const seq = React.useRef(0);
  const effectiveType = mode === 'link' ? 'notes' : type;

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setError(null);
    }
  }, [open, mode]);

  // Debounced; responses that arrive out of order are ignored via the sequence counter
  React.useEffect(() => {
    if (!open) return;
    if (!query.trim() && !tag && !status) {
      setResults([]);
      setLoading(false);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await searchWorkspaceAction({ workspaceId, query, type: effectiveType, tag: tag || undefined, status: status || undefined }).catch(() => null);
      if (id !== seq.current) return;
      setLoading(false);
      setActive(0);
      if (res?.ok) {
        setResults(res.data);
        setError(null);
      } else {
        setResults([]);
        setError(res ? res.error.message : 'Koneksi ke server terputus.');
      }
    }, 150);
    return () => clearTimeout(t);
  }, [open, query, effectiveType, tag, status, workspaceId]);

  const choose = (r: SearchResultDTO) => {
    onSelect(r);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      choose(results[active]);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} labelledBy="search-title" align="top" className="max-w-xl">
      <div className="border-3 border-[var(--border-hard)] bg-[var(--bg-surface)] shadow-[var(--dream-aura-shadow)] p-4 sm:p-5 space-y-4">
        <h2 id="search-title" className="sr-only">
          {mode === 'link' ? 'Pilih dokumen untuk ditautkan' : 'Pencarian workspace'}
        </h2>
        <div className="flex items-center gap-3 px-3 py-2.5 border-2.5 border-[var(--border-hard)] bg-[var(--bg-surface-elevated)] shadow-[2px_2px_0px_var(--border-hard)]">
          {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0 text-[var(--text-main)]" /> : <Search className="w-4 h-4 text-ink-cyan shrink-0" />}
          <input
            data-autofocus
            type="search"
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="search-results"
            aria-activedescendant={results[active] ? `sr-${active}` : undefined}
            placeholder={mode === 'link' ? 'Cari judul dokumen untuk ditautkan…' : 'Cari catatan, tugas, tag, proyek…'}
            className="bg-transparent flex-1 font-mono text-xs font-bold text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 border border-[var(--border-hard)] text-[var(--text-muted)]">ESC</kbd>
        </div>

        {mode === 'search' && (
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs border-b-2 border-[var(--border-hard)] pb-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                aria-pressed={type === t.key}
                className={cn(
                  'px-2.5 py-1 text-[10px] font-bold border-2 transition-all',
                  type === t.key
                    ? 'border-[var(--border-hard)] bg-[var(--border-hard)] text-[var(--bg-surface)] shadow-[2px_2px_0px_var(--border-hard)]'
                    : 'border-transparent text-[var(--text-sub)] hover:text-[var(--text-main)]'
                )}
              >
                {t.label}
              </button>
            ))}
            <div className="flex gap-1.5 ml-auto">
              {(type === 'all' || type === 'notes') && tags.length > 0 && (
                <select aria-label="Filter tag" className={filterSelect} value={tag} onChange={(e) => setTag(e.target.value)}>
                  <option value="">#TAG</option>
                  {tags.map((t) => (
                    <option key={t} value={t}>
                      #{t}
                    </option>
                  ))}
                </select>
              )}
              {(type === 'all' || type === 'tasks') && (
                <select aria-label="Filter status" className={filterSelect} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | '')}>
                  <option value="">STATUS</option>
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        <ul id="search-results" role="listbox" className="space-y-2 max-h-[50vh] overflow-y-auto font-mono text-xs">
          {error && <li className="p-3 border-2 border-[var(--border-hard)] bg-accent-yellow text-[#0A0A0C] font-bold">{error}</li>}
          {!loading && !error && (query || tag || status) && results.length === 0 && (
            <li className="p-4 text-center text-[var(--text-muted)]">Tidak ditemukan hasil untuk &quot;{query}&quot;.</li>
          )}
          {results.map((r, i) => (
            <li
              key={`${r.type}-${r.id}`}
              id={`sr-${i}`}
              role="option"
              aria-selected={i === active}
              onClick={() => choose(r)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'p-3 border-2 border-[var(--border-hard)] cursor-pointer space-y-1 transition-all',
                i === active ? 'bg-[var(--bg-surface)] shadow-[3px_3px_0px_var(--border-hard)] -translate-x-px -translate-y-px' : 'bg-[var(--bg-surface-elevated)]'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <Badge variant={BADGE[r.type]} className="text-[9px] shrink-0">
                    {r.type === 'note' ? 'NOTE' : r.type === 'task' ? 'TASK' : 'PROJECT'}
                  </Badge>
                  <span className="font-bold text-[var(--text-main)] truncate">{r.title}</span>
                </span>
                <span className="text-[10px] text-[var(--text-sub)] shrink-0 truncate max-w-[40%]">
                  {r.status ? STATUS_LABEL[r.status] : r.tags?.length ? r.tags.map((t) => `#${t}`).join(' ') : r.type === 'note' ? r.projectName : ''}
                </span>
              </div>
              {r.snippet && <p className="text-[10px] text-[var(--text-muted)] line-clamp-2 font-sans">{r.snippet}</p>}
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
