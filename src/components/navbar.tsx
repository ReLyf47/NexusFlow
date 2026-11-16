'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Check, ChevronDown, FileText, Kanban, LogOut, Moon, Plus, Search, Settings, Sun } from 'lucide-react';
import { createWorkspaceAction, logoutAction } from '@/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/menu';
import { useRun } from '@/components/toast';
import { ROLE_RANK, ROLES, type Role, type UserDTO, type WorkspaceRefDTO } from '@/lib/domain';
import { cn } from '@/lib/utils';

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

const ROLE_STAMP: Record<Role, string> = {
  Admin: 'bg-accent-pink text-[#0A0A0C]',
  Editor: 'bg-accent-cyan text-[#0A0A0C]',
  Viewer: 'bg-accent-yellow text-[#0A0A0C]',
};

export function ThemeToggle({ className, compact }: { className?: string; compact?: boolean }) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={className}
      aria-label={isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
      title="Ganti Mode Light / Dark"
    >
      {isDark ? <Sun className="w-4 h-4 text-ink-orange" /> : <Moon className="w-4 h-4 text-ink-purple" />}
      {!compact && <span className="hidden md:inline">{isDark ? 'DARK' : 'LIGHT'}</span>}
    </button>
  );
}

interface NavbarProps {
  workspace: { id: string; name: string; slug: string };
  workspaces: WorkspaceRefDTO[];
  me: UserDTO;
  role: Role;
  effectiveRole: Role;
  onRoleChange?: (role: Role) => void;
  view?: 'notes' | 'kanban';
  onViewChange?: (view: 'notes' | 'kanban') => void;
  onOpenSearch?: () => void;
}

const chip =
  'border-2.5 border-[var(--border-hard)] bg-[var(--bg-surface)] shadow-[2px_2px_0px_var(--border-hard)] hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[1px] active:translate-y-[1px] transition-all text-xs font-mono font-bold text-[var(--text-main)]';

export function Navbar({ workspace, workspaces, me, role, effectiveRole, onRoleChange, view, onViewChange, onOpenSearch }: NavbarProps) {
  const router = useRouter();
  const run = useRun();
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState('');

  const createWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    const ws = await run(createWorkspaceAction({ name: newName }), 'Workspace baru dibuat.');
    if (ws) {
      setCreating(false);
      setNewName('');
      router.push(`/w/${ws.slug}`);
    }
  };

  return (
    <header className="h-16 border-b-3 border-[var(--border-hard)] bg-[var(--bg-surface)] px-3 sm:px-6 flex items-center justify-between gap-2 sticky top-0 z-40">
      {/* Left: brand + workspace switcher */}
      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
        <Link
          href={`/w/${workspace.slug}`}
          className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 border-2.5 border-[var(--border-hard)] bg-[var(--border-hard)] flex items-center justify-center shadow-[2px_2px_0px_var(--border-hard)] hover:scale-105 transition-transform"
          aria-label="NexusFlow — kembali ke workspace"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-accent-cyan dark:text-accent-pink" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 1L14.8 9.2L23 12L14.8 14.8L12 23L9.2 14.8L1 12L9.2 9.2L12 1Z" />
          </svg>
        </Link>
        <div className="hidden min-[420px]:flex items-center gap-2">
          <span className="font-display font-black text-base sm:text-lg tracking-tight uppercase text-[var(--text-main)]">
            NEXUS<span className="text-ink-pink dark:text-ink-cyan">//FLOW</span>
          </span>
          <Badge variant="y2k" className="hidden sm:inline-flex">
            PROD_V1.0
          </Badge>
        </div>
        <div className="h-6 w-[2px] bg-[var(--border-hard)] hidden lg:block" />
        <Menu
          label="Pilih workspace"
          align="left"
          triggerClassName={cn(chip, 'hidden lg:flex items-center gap-2 px-3 py-1.5 max-w-[200px]')}
          trigger={
            <>
              <span className="w-2 h-2 shrink-0 rounded-full bg-accent-mint border border-[var(--border-hard)]" />
              <span className="truncate">{workspace.name}</span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </>
          }
        >
          <div className="px-3 py-1.5 text-[10px] text-[var(--text-muted)] uppercase tracking-widest">// WORKSPACES</div>
          {workspaces.map((w) => (
            <MenuItem key={w.id} onClick={() => router.push(`/w/${w.slug}`)}>
              <span className="w-3.5">{w.id === workspace.id && <Check className="w-3.5 h-3.5" />}</span>
              <span className="truncate flex-1">{w.name}</span>
              <span className="text-[9px] opacity-70">{w.role.toUpperCase()}</span>
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onClick={() => router.push(`/w/${workspace.slug}/settings`)}>
            <Settings className="w-3.5 h-3.5" /> Pengaturan workspace
          </MenuItem>
          <MenuItem onClick={() => setCreating(true)}>
            <Plus className="w-3.5 h-3.5" /> Workspace baru
          </MenuItem>
        </Menu>
      </div>

      {/* Center: search trigger */}
      {onOpenSearch && (
        <div className="hidden sm:flex flex-1 min-w-0 max-w-xs md:max-w-md mx-2">
          <button onClick={onOpenSearch} className={cn(chip, 'w-full flex items-center justify-between px-3 py-1.5 font-normal text-[var(--text-sub)]')}>
            <span className="flex items-center gap-2 truncate">
              <Search className="w-4 h-4 text-[var(--text-main)] shrink-0" />
              <span className="truncate">Cari dokumen, tugas, tag...</span>
            </span>
            <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-bold border border-[var(--border-hard)] bg-[var(--bg-canvas)] text-[var(--text-main)]">
              ⌘K
            </kbd>
          </button>
        </div>
      )}

      {/* Right: theme, view switcher, role, avatar */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <ThemeToggle className={cn(chip, 'hidden sm:flex px-2.5 py-1.5 items-center gap-1.5')} />

        {onViewChange && (
          <div className="hidden lg:flex items-center border-2.5 border-[var(--border-hard)] bg-[var(--bg-canvas)] p-0.5 text-xs font-mono font-bold" role="group" aria-label="Tampilan">
            {(['notes', 'kanban'] as const).map((v) => (
              <button
                key={v}
                onClick={() => onViewChange(v)}
                aria-pressed={view === v}
                className={cn(
                  'px-2.5 py-1 flex items-center gap-1 transition-all',
                  view === v ? 'bg-[var(--border-hard)] text-[var(--bg-surface)]' : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'
                )}
              >
                {v === 'notes' ? <FileText className="w-3.5 h-3.5" /> : <Kanban className="w-3.5 h-3.5" />}
                <span>{v === 'notes' ? 'EDITOR' : 'KANBAN'}</span>
              </button>
            ))}
          </div>
        )}

        {onRoleChange && (
          <div className={cn(chip, 'flex items-center gap-1 px-2 py-1 hover:translate-x-0 hover:translate-y-0')}>
            <label htmlFor="role-select" className="text-[10px] text-[var(--text-muted)] hidden sm:inline">
              ROLE:
            </label>
            <select
              id="role-select"
              aria-label="Peran aktif (pratinjau hanya bisa menurunkan izin)"
              value={effectiveRole}
              onChange={(e) => onRoleChange(e.target.value as Role)}
              className="bg-transparent font-bold cursor-pointer text-[var(--text-main)] focus:outline-none text-[11px] sm:text-xs"
            >
              {ROLES.map((r) => (
                <option key={r} value={r} disabled={ROLE_RANK[r] > ROLE_RANK[role]} className="bg-[var(--bg-surface)] text-[var(--text-main)]">
                  {r.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}

        <Menu
          label={`Akun ${me.name}`}
          triggerClassName={cn(
            'w-8 h-8 border-2 border-[var(--border-hard)] font-mono font-black text-xs flex items-center justify-center shadow-[2px_2px_0px_var(--border-hard)]',
            ROLE_STAMP[effectiveRole]
          )}
          trigger={initials(me.name)}
        >
          <div className="px-3 py-2 border-b-2 border-[var(--border-hard)]">
            <div className="font-bold text-[var(--text-main)] truncate">{me.name}</div>
            <div className="text-[10px] text-[var(--text-muted)] truncate">{me.email}</div>
            <div className="text-[10px] text-ink-pink mt-1">PERAN: {role.toUpperCase()}</div>
          </div>
          <div className="lg:hidden">
            {workspaces.map((w) => (
              <MenuItem key={w.id} onClick={() => router.push(`/w/${w.slug}`)}>
                <span className="w-3.5">{w.id === workspace.id && <Check className="w-3.5 h-3.5" />}</span>
                <span className="truncate">{w.name}</span>
              </MenuItem>
            ))}
            <MenuItem onClick={() => setCreating(true)}>
              <Plus className="w-3.5 h-3.5" /> Workspace baru
            </MenuItem>
            <MenuSeparator />
          </div>
          <MenuItem onClick={() => router.push(`/w/${workspace.slug}/settings`)}>
            <Settings className="w-3.5 h-3.5" /> Pengaturan
          </MenuItem>
          <form action={logoutAction}>
            <MenuItem type="submit">
              <LogOut className="w-3.5 h-3.5" /> Keluar
            </MenuItem>
          </form>
        </Menu>
      </div>

      <Dialog open={creating} onClose={() => setCreating(false)} labelledBy="new-ws-title" className="max-w-md">
        <form onSubmit={createWorkspace} className="border-3 border-[var(--border-hard)] bg-[var(--bg-surface)] shadow-[var(--dream-aura-shadow)] p-5 space-y-4">
          <h2 id="new-ws-title" className="font-display font-black uppercase text-lg text-[var(--text-main)]">
            Workspace Baru
          </h2>
          <p className="text-sm text-[var(--text-sub)]">Anda otomatis menjadi Admin workspace ini.</p>
          <label className="block space-y-1.5">
            <span className="font-mono text-[11px] font-bold text-[var(--text-sub)]">NAMA_WORKSPACE</span>
            <Input data-autofocus value={newName} onChange={(e) => setNewName(e.target.value)} required minLength={2} maxLength={120} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreating(false)}>
              [BATAL]
            </Button>
            <Button type="submit" variant="holographic">
              BUAT_WORKSPACE
            </Button>
          </div>
        </form>
      </Dialog>
    </header>
  );
}
