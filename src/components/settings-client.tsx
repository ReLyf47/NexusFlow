'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Cpu, FolderKanban, Settings, Trash2, Users } from 'lucide-react';
import {
  aiStatusAction,
  deleteWorkspaceAction,
  inviteMemberAction,
  removeMemberAction,
  renameProjectAction,
  renameWorkspaceAction,
  updateLlmSettingsAction,
  updateMemberRoleAction,
} from '@/actions';
import { Navbar } from '@/components/navbar';
import { useRun } from '@/components/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DEFAULT_PROJECT, ROLES, type LlmProvider, type Role, type WorkspaceSnapshotDTO } from '@/lib/domain';

const section = 'border-3 border-[var(--border-hard)] bg-[var(--bg-surface)] shadow-[var(--solid-shadow)] p-5 sm:p-6 space-y-4';
const heading = 'font-display font-black text-lg uppercase text-[var(--text-main)] flex items-center gap-2';
const labelCls = 'font-mono text-[11px] font-bold text-[var(--text-sub)] uppercase';
const select = 'h-10 border-2.5 border-[var(--border-hard)] bg-[var(--bg-surface-elevated)] px-2 font-mono text-xs font-bold text-[var(--text-main)] disabled:opacity-60';

export function SettingsClient({ data }: { data: WorkspaceSnapshotDTO }) {
  const run = useRun();
  const router = useRouter();
  const isAdmin = data.effectiveRole === 'Admin';
  const [name, setName] = React.useState(data.workspace.name);
  const [members, setMembers] = React.useState(data.members);
  const [invite, setInvite] = React.useState<{ email: string; role: Role }>({ email: '', role: 'Editor' });
  const llm = data.workspace.llm;
  const [provider, setProvider] = React.useState<LlmProvider>(llm.provider);
  const [baseUrl, setBaseUrl] = React.useState(llm.baseUrl ?? '');
  const [model, setModel] = React.useState(llm.model);
  const [apiKey, setApiKey] = React.useState('');
  const [hasKey, setHasKey] = React.useState(llm.hasApiKey);
  const [ping, setPing] = React.useState<string | null>(null);
  const [confirmSlug, setConfirmSlug] = React.useState('');

  const projects = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const d of data.documents) m.set(d.projectName, (m.get(d.projectName) ?? 0) + 1);
    return [...m].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data.documents]);
  const [renames, setRenames] = React.useState<Record<string, string>>({});

  const wsId = data.workspace.id;

  return (
    <div className="flex-1 flex flex-col relative z-10 min-h-screen">
      <Navbar workspace={data.workspace} workspaces={data.workspaces} me={data.me} role={data.role} effectiveRole={data.effectiveRole} />
      <main className="max-w-3xl w-full mx-auto p-4 sm:p-8 space-y-6 pb-16">
        <div className="space-y-1">
          <Link href={`/w/${data.workspace.slug}`} className="font-mono text-xs font-bold text-[var(--text-sub)] hover:text-[var(--text-main)] inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> KEMBALI_KE_WORKSPACE
          </Link>
          <h1 className="font-display font-black text-2xl sm:text-3xl uppercase text-[var(--text-main)]">Pengaturan Workspace</h1>
          {!isAdmin && (
            <p className="font-mono text-xs text-[var(--text-muted)]">Hanya Admin yang dapat mengubah pengaturan. Anda melihat dalam mode baca.</p>
          )}
        </div>

        {/* Workspace */}
        <section className={section} aria-labelledby="ws-heading">
          <h2 id="ws-heading" className={heading}>
            <Settings className="w-5 h-5" /> Workspace
          </h2>
          <form
            className="flex flex-col sm:flex-row gap-2 sm:items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(renameWorkspaceAction({ workspaceId: wsId, name }), 'Nama workspace disimpan.')) router.refresh();
            }}
          >
            <label className="flex-1 space-y-1.5">
              <span className={labelCls}>Nama</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} minLength={2} maxLength={120} required />
            </label>
            {isAdmin && <Button type="submit">SIMPAN</Button>}
          </form>
          <p className="font-mono text-[11px] text-[var(--text-muted)]">SLUG: {data.workspace.slug}</p>
        </section>

        {/* Members & roles */}
        <section className={section} aria-labelledby="members-heading">
          <h2 id="members-heading" className={heading}>
            <Users className="w-5 h-5" /> Anggota & Role
          </h2>
          <ul className="divide-y-2 divide-[var(--border-hard)] border-2.5 border-[var(--border-hard)]">
            {members.map((m) => {
              const owner = m.userId === data.workspace.ownerId;
              return (
                <li key={m.id} className="p-3 flex flex-wrap items-center justify-between gap-2 bg-[var(--bg-surface-elevated)]">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-[var(--text-main)] truncate">
                      {m.name} {m.userId === data.me.id && <span className="font-mono text-[10px] text-[var(--text-muted)]">(ANDA)</span>}
                    </div>
                    <div className="font-mono text-[11px] text-[var(--text-muted)] truncate">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {owner && <Badge variant="y2k">OWNER</Badge>}
                    <select
                      aria-label={`Peran ${m.name}`}
                      className={select}
                      value={m.role}
                      disabled={!isAdmin || owner}
                      onChange={async (e) => {
                        const updated = await run(
                          updateMemberRoleAction({ workspaceId: wsId, memberId: m.id, role: e.target.value as Role }),
                          'Peran diperbarui.'
                        );
                        if (updated) setMembers((list) => list.map((x) => (x.id === m.id ? updated : x)));
                      }}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    {isAdmin && !owner && (
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label={`Keluarkan ${m.name}`}
                        onClick={async () => {
                          if (!confirm(`Keluarkan ${m.name} dari workspace?`)) return;
                          if (await run(removeMemberAction({ workspaceId: wsId, memberId: m.id }), 'Anggota dikeluarkan.')) {
                            setMembers((list) => list.filter((x) => x.id !== m.id));
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {isAdmin && (
            <form
              className="flex flex-col sm:flex-row gap-2 sm:items-end"
              onSubmit={async (e) => {
                e.preventDefault();
                const member = await run(inviteMemberAction({ workspaceId: wsId, ...invite }), 'Anggota ditambahkan.');
                if (member) {
                  setMembers((list) => [...list, member]);
                  setInvite({ email: '', role: 'Editor' });
                }
              }}
            >
              <label className="flex-1 space-y-1.5">
                <span className={labelCls}>Undang via email (akun terdaftar)</span>
                <Input type="email" required value={invite.email} onChange={(e) => setInvite((s) => ({ ...s, email: e.target.value }))} placeholder="nama@contoh.dev" />
              </label>
              <select aria-label="Peran anggota baru" className={select} value={invite.role} onChange={(e) => setInvite((s) => ({ ...s, role: e.target.value as Role }))}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.toUpperCase()}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="holographic">
                UNDANG
              </Button>
            </form>
          )}
        </section>

        {/* LLM config */}
        <section className={section} aria-labelledby="llm-heading">
          <h2 id="llm-heading" className={heading}>
            <Cpu className="w-5 h-5" /> Konfigurasi LLM
          </h2>
          {isAdmin ? (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await run(
                  updateLlmSettingsAction({ workspaceId: wsId, provider, baseUrl, model, ...(apiKey ? { apiKey } : {}) }),
                  'Konfigurasi LLM disimpan.'
                );
                if (res) {
                  setHasKey(res.hasApiKey);
                  setApiKey('');
                  setModel(res.model);
                  setBaseUrl(res.baseUrl ?? '');
                }
              }}
            >
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className={labelCls}>Provider</span>
                  <select className={`${select} w-full`} value={provider} onChange={(e) => setProvider(e.target.value as LlmProvider)}>
                    <option value="ollama">Ollama (lokal)</option>
                    <option value="openai">OpenAI / kompatibel</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className={labelCls}>Model</span>
                  <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={provider === 'openai' ? 'gpt-4o-mini' : 'llama3:latest'} maxLength={100} />
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className={labelCls}>Base URL (kosong = default)</span>
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={provider === 'openai' ? 'https://api.openai.com/v1' : 'http://localhost:11434'} maxLength={255} />
              </label>
              {provider === 'openai' && (
                <label className="block space-y-1.5">
                  <span className={labelCls}>API key (disimpan terenkripsi, tidak pernah ditampilkan)</span>
                  <Input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={hasKey ? '•••••••• tersimpan — isi untuk mengganti' : 'sk-…'} />
                  {hasKey && (
                    <button
                      type="button"
                      className="font-mono text-[11px] font-bold text-ink-pink underline"
                      onClick={async () => {
                        const res = await run(updateLlmSettingsAction({ workspaceId: wsId, provider, baseUrl, model, apiKey: '' }), 'API key dihapus.');
                        if (res) setHasKey(false);
                      }}
                    >
                      Hapus API key tersimpan
                    </button>
                  )}
                </label>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" variant="holographic">
                  SIMPAN_KONFIGURASI
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    setPing('MENGUJI…');
                    const res = await aiStatusAction({ workspaceId: wsId }).catch(() => null);
                    setPing(res?.ok ? `${res.data.engine}: ${res.data.online ? 'ONLINE' : 'OFFLINE'}` : 'GAGAL MENGUJI');
                  }}
                >
                  TES_KONEKSI
                </Button>
                {ping && <span className="font-mono text-xs font-bold text-[var(--text-main)]" aria-live="polite">{ping}</span>}
              </div>
            </form>
          ) : (
            <p className="font-mono text-sm text-[var(--text-main)]">
              {llm.provider.toUpperCase()} // {llm.model}
            </p>
          )}
        </section>

        {/* Projects */}
        <section className={section} aria-labelledby="proj-heading">
          <h2 id="proj-heading" className={heading}>
            <FolderKanban className="w-5 h-5" /> Proyek
          </h2>
          <ul className="space-y-2">
            {projects.map(([project, count]) => (
              <li key={project} className="flex flex-wrap items-center gap-2 p-2 border-2 border-[var(--border-hard)] bg-[var(--bg-surface-elevated)]">
                {isAdmin ? (
                  <form
                    className="flex flex-1 flex-wrap items-center gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const to = (renames[project] ?? project).trim();
                      if (to && to !== project && (await run(renameProjectAction({ workspaceId: wsId, from: project, to }), 'Proyek diganti nama.'))) router.refresh();
                    }}
                  >
                    <Input
                      aria-label={`Nama proyek ${project}`}
                      className="flex-1 min-w-[160px] h-9"
                      value={renames[project] ?? project}
                      onChange={(e) => setRenames((r) => ({ ...r, [project]: e.target.value }))}
                      maxLength={100}
                    />
                    <span className="font-mono text-[11px] text-[var(--text-muted)]">{count} dok</span>
                    <Button size="sm" type="submit">
                      GANTI_NAMA
                    </Button>
                    {project !== DEFAULT_PROJECT && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (!confirm(`Hapus proyek "${project}"? Dokumennya dipindah ke ${DEFAULT_PROJECT}.`)) return;
                          if (await run(renameProjectAction({ workspaceId: wsId, from: project, to: DEFAULT_PROJECT }), 'Proyek dihapus.')) router.refresh();
                        }}
                      >
                        HAPUS
                      </Button>
                    )}
                  </form>
                ) : (
                  <span className="font-mono text-xs font-bold text-[var(--text-main)]">
                    {project} · {count} dok
                  </span>
                )}
              </li>
            ))}
          </ul>
          {isAdmin && <p className="font-mono text-[11px] text-[var(--text-muted)]">Proyek baru dibuat dari editor dokumen (pilih “+ Proyek baru…”).</p>}
        </section>

        {isAdmin && (
          <section className={`${section} border-dashed`} aria-labelledby="danger-heading">
            <h2 id="danger-heading" className={`${heading} text-ink-pink`}>
              <Trash2 className="w-5 h-5" /> Zona Berbahaya
            </h2>
            <p className="text-sm text-[var(--text-sub)]">
              Menghapus workspace menghapus semua dokumen, tugas, dan tag di dalamnya secara permanen. Ketik <code className="font-mono font-bold">{data.workspace.slug}</code> untuk konfirmasi.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input aria-label="Konfirmasi slug" value={confirmSlug} onChange={(e) => setConfirmSlug(e.target.value)} />
              <Button
                variant="destructive"
                disabled={confirmSlug !== data.workspace.slug}
                onClick={async () => {
                  if (await run(deleteWorkspaceAction({ workspaceId: wsId }), 'Workspace dihapus.')) router.push('/');
                }}
              >
                HAPUS_WORKSPACE
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
