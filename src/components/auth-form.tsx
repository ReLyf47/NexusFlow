'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState } from 'react';
import { createWorkspaceAction, loginAction, registerAction } from '@/actions';
import { useRun } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const Logo = () => (
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 border-2.5 border-[var(--border-hard)] bg-[var(--border-hard)] flex items-center justify-center shadow-[2px_2px_0px_var(--border-hard)]">
      <svg className="w-6 h-6 text-accent-cyan dark:text-accent-pink" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 1L14.8 9.2L23 12L14.8 14.8L12 23L9.2 14.8L1 12L9.2 9.2L12 1Z" />
      </svg>
    </div>
    <span className="font-display font-black text-xl uppercase text-[var(--text-main)]">
      NEXUS<span className="text-ink-pink dark:text-ink-cyan">//FLOW</span>
    </span>
  </div>
);

const labelCls = 'font-mono text-[11px] font-bold text-[var(--text-sub)] uppercase';

export function AuthForm({ mode, next, showDemo }: { mode: 'login' | 'register'; next?: string; showDemo?: boolean }) {
  const [state, formAction, pending] = useActionState(mode === 'login' ? loginAction : registerAction, null);
  const error = state && !state.ok ? state.error : null;
  const fieldError = (k: string) => error?.fields?.[k]?.[0];

  return (
    <main className="flex-1 flex items-center justify-center p-4 relative z-10">
      <div className="w-full max-w-md space-y-6">
        <Logo />
        <form action={formAction} className="border-3 border-[var(--border-hard)] bg-[var(--bg-surface)] shadow-[var(--dream-aura-shadow)] p-6 space-y-4" noValidate={false}>
          <div>
            <div className="font-mono text-xs font-bold text-ink-pink">{mode === 'login' ? '// AUTH_LOGIN' : '// AUTH_REGISTER'}</div>
            <h1 className="font-display font-black text-2xl uppercase text-[var(--text-main)]">{mode === 'login' ? 'Masuk' : 'Buat Akun'}</h1>
          </div>
          {next && <input type="hidden" name="next" value={next} />}
          {mode === 'register' && (
            <label className="block space-y-1.5">
              <span className={labelCls}>Nama lengkap</span>
              <Input name="name" autoComplete="name" required minLength={2} maxLength={100} aria-invalid={!!fieldError('name')} />
              {fieldError('name') && <span className="text-xs text-ink-pink font-bold">{fieldError('name')}</span>}
            </label>
          )}
          <label className="block space-y-1.5">
            <span className={labelCls}>Email</span>
            <Input name="email" type="email" autoComplete="email" required aria-invalid={!!fieldError('email')} />
            {fieldError('email') && <span className="text-xs text-ink-pink font-bold">{fieldError('email')}</span>}
          </label>
          <label className="block space-y-1.5">
            <span className={labelCls}>Password</span>
            <Input
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'register' ? 8 : 1}
              maxLength={72}
              aria-invalid={!!fieldError('password')}
            />
            {fieldError('password') && <span className="text-xs text-ink-pink font-bold">{fieldError('password')}</span>}
          </label>
          {error && !error.fields && (
            <p role="alert" className="border-2.5 border-[var(--border-hard)] bg-accent-yellow text-[#0A0A0C] p-3 font-mono text-xs font-bold">
              {error.message}
            </p>
          )}
          <Button type="submit" variant="holographic" size="lg" className="w-full" disabled={pending}>
            {pending ? 'MEMPROSES…' : mode === 'login' ? 'MASUK' : 'DAFTAR'}
          </Button>
          <p className="text-sm text-[var(--text-sub)] text-center">
            {mode === 'login' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
            <Link href={mode === 'login' ? '/register' : '/login'} className="font-bold underline underline-offset-4 text-[var(--text-main)]">
              {mode === 'login' ? 'Daftar' : 'Masuk'}
            </Link>
          </p>
        </form>
        {showDemo && (
          <div className="border-2 border-dashed border-[var(--border-hard)] bg-[var(--bg-surface)] p-4 font-mono text-[11px] text-[var(--text-sub)] space-y-1">
            <div className="font-bold text-[var(--text-main)]">// DEMO_ACCOUNTS (bun run db:seed) · password: nexusflow123</div>
            <div>alif@nexusflow.dev — Admin</div>
            <div>sarah@nexusflow.dev — Editor</div>
            <div>rian@nexusflow.dev — Viewer</div>
          </div>
        )}
      </div>
    </main>
  );
}

export function CreateWorkspaceForm({ name }: { name: string }) {
  const run = useRun();
  const router = useRouter();
  const [value, setValue] = React.useState(`Workspace ${name.split(' ')[0]}`);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const ws = await run(createWorkspaceAction({ name: value }));
        if (ws) router.push(`/w/${ws.slug}`);
      }}
      className="w-full max-w-md border-3 border-[var(--border-hard)] bg-[var(--bg-surface)] shadow-[var(--solid-shadow)] p-6 space-y-4"
    >
      <Logo />
      <h1 className="font-display font-black text-2xl uppercase text-[var(--text-main)]">Buat Workspace</h1>
      <p className="text-sm text-[var(--text-sub)]">Anda belum tergabung di workspace mana pun.</p>
      <Input aria-label="Nama workspace" value={value} onChange={(e) => setValue(e.target.value)} required minLength={2} maxLength={120} />
      <Button type="submit" variant="holographic" className="w-full">
        BUAT_WORKSPACE
      </Button>
    </form>
  );
}
