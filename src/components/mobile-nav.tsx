'use client';

import { FileText, FolderTree, Kanban, Search } from 'lucide-react';
import { ThemeToggle } from '@/components/navbar';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  currentView: 'notes' | 'kanban';
  onViewChange: (view: 'notes' | 'kanban') => void;
  onOpenSearch: () => void;
  onOpenDocs: () => void;
}

const item = 'flex flex-col items-center justify-center gap-0.5 py-1 px-2.5 border-2 transition-all min-w-[56px]';

export function MobileNav({ currentView, onViewChange, onOpenSearch, onOpenDocs }: MobileNavProps) {
  const tab = (view: 'notes' | 'kanban') =>
    cn(
      item,
      currentView === view
        ? 'border-[var(--border-hard)] bg-[var(--bg-canvas)] text-[var(--text-main)]'
        : 'border-transparent text-[var(--text-sub)]'
    );
  return (
    <nav
      aria-label="Navigasi utama"
      className="sm:hidden fixed bottom-0 left-0 right-0 h-16 border-t-3 border-[var(--border-hard)] bg-[var(--bg-surface)] z-40 flex items-center justify-around px-1 font-mono font-bold text-[10px] select-none pb-[env(safe-area-inset-bottom)]"
    >
      <button onClick={onOpenDocs} className={cn(item, 'border-transparent text-[var(--text-sub)]')}>
        <FolderTree className="w-4 h-4" />
        <span>DOCS</span>
      </button>
      <button onClick={() => onViewChange('notes')} className={tab('notes')} aria-pressed={currentView === 'notes'}>
        <FileText className="w-4 h-4" />
        <span>EDITOR</span>
      </button>
      <button onClick={() => onViewChange('kanban')} className={tab('kanban')} aria-pressed={currentView === 'kanban'}>
        <Kanban className="w-4 h-4" />
        <span>KANBAN</span>
      </button>
      <button onClick={onOpenSearch} className={cn(item, 'border-transparent text-[var(--text-sub)]')}>
        <Search className="w-4 h-4" />
        <span>CARI</span>
      </button>
      <ThemeToggle compact className={cn(item, 'border-transparent text-[var(--text-sub)]')} />
    </nav>
  );
}
