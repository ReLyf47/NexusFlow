// Idempotent demo seed. Re-running is safe: users are upserted row-by-row and the demo
// workspace is only created when missing. `bun run db:seed -- --reset` rebuilds it.
import { eq, inArray, sql } from 'drizzle-orm';
import { db, poolConnection } from './index';
import { documents, users, workspaceMembers, workspaces } from './schema';
import { hashPassword } from '../lib/password';
import type { Actor } from '../lib/auth';
import { createDocument } from '../services/documents';
import { createTask, createTasksBatch } from '../services/tasks';

export const DEMO_PASSWORD = 'nexusflow123';
export const DEMO_SLUG = 'nexus-core';

const ids = {
  workspace: '00000000-0000-4000-8000-000000000001',
  alif: '10000000-0000-4000-8000-000000000001',
  sarah: '10000000-0000-4000-8000-000000000002',
  dimas: '10000000-0000-4000-8000-000000000003',
  rian: '10000000-0000-4000-8000-000000000004',
};

const demoUsers = [
  { id: ids.alif, name: 'Alif Akbar Arraiyan', email: 'alif@nexusflow.dev', role: 'Admin' as const },
  { id: ids.sarah, name: 'Sarah Wijaya', email: 'sarah@nexusflow.dev', role: 'Editor' as const },
  { id: ids.dimas, name: 'Dimas Pratama', email: 'dimas@nexusflow.dev', role: 'Editor' as const },
  { id: ids.rian, name: 'Rian Hidayat', email: 'rian@nexusflow.dev', role: 'Viewer' as const },
];

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const human = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

const actor = (id: string): Actor => {
  const u = demoUsers.find((x) => x.id === id)!;
  return { id: u.id, name: u.name, email: u.email, avatarUrl: null, tokenVersion: 0, rolePreview: null };
};

export async function runSeed({ reset = false } = {}) {
  console.log('🌱 Seeding NexusFlow demo data...');

  // 1. Users — per-row upsert (VALUES() keeps each row's own data)
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await db
    .insert(users)
    .values(demoUsers.map(({ id, name, email }) => ({ id, name, email, passwordHash })))
    .onDuplicateKeyUpdate({ set: { name: sql`values(${users.name})`, passwordHash: sql`values(${users.passwordHash})` } });

  const [existing] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.slug, DEMO_SLUG)).limit(1);
  if (existing && !reset) {
    console.log(`✅ Workspace "${DEMO_SLUG}" sudah ada — dilewati. Gunakan --reset untuk membangun ulang.`);
    return;
  }
  if (existing) await db.delete(workspaces).where(eq(workspaces.id, existing.id)); // cascades to members, docs, tasks, tags

  // 2. Workspace + members
  await db.insert(workspaces).values({ id: ids.workspace, name: 'NexusFlow Core Engineering', slug: DEMO_SLUG, ownerId: ids.alif });
  await db.insert(workspaceMembers).values(
    demoUsers.map((u, i) => ({ id: `40000000-0000-4000-8000-00000000000${i + 1}`, workspaceId: ids.workspace, userId: u.id, role: u.role }))
  );

  // 3. Documents — created through the service so tags & wikilink backlinks are derived exactly like in the app
  const admin = actor(ids.alif);
  const create = async (title: string, projectName: string, tags: string[], content: string, authorId = ids.alif) => {
    const { document } = await createDocument(admin, { workspaceId: ids.workspace, title, projectName, tags, content });
    if (authorId !== ids.alif) await db.update(documents).set({ authorId }).where(eq(documents.id, document.id));
    return document.id;
  };

  const sprint = 'Sprint 4: Core Engine';
  const dbDoc = await create(
    'Arsitektur DB & RBAC Matrix',
    sprint,
    ['database', 'architecture'],
    `Skema relasional MariaDB 11.4 dengan Drizzle ORM: 8 tabel dengan integritas referensial dan *compound index*.

| Aksi | Admin | Editor | Viewer |
| :--- | :---: | :---: | :---: |
| Kelola anggota & role | ✓ | – | – |
| Konfigurasi LLM | ✓ | – | – |
| Buat proyek baru | ✓ | – | – |
| Buat & edit catatan | ✓ | ✓ | – |
| Hapus catatan | ✓ | milik sendiri | – |
| Ubah status & assign task | ✓ | ✓ | – |
| Jalankan fitur AI | ✓ | ✓ | – |
| Baca catatan, task & konteks | ✓ | ✓ | ✓ |

Indeks utama: \`workspace_user_idx\`, \`doc_ws_proj_idx\`, \`task_ws_status_idx\`, \`doc_link_idx\`.`,
    ids.dimas
  );

  const weekly = await create(
    'Weekly Sync & Sprint 4 Planning',
    sprint,
    ['backend', 'sprint4', 'architecture'],
    `## 1. Multi-Role Access Control (RBAC)

Sistem otentikasi JWT telah selesai dibangun. Tahap berikutnya adalah membatasi visibilitas dan kontrol pengeditan data secara granular: setiap request diverifikasi tokennya lalu dicocokkan dengan peran anggota pada tabel \`workspace_members\`.

- **Admin** — kendali penuh ruang kerja, manajemen role anggota, konfigurasi API LLM.
- **Editor** — menulis dan mengedit catatan, menjalankan ekstraksi tugas AI.
- **Viewer** — akses baca murni tanpa izin memodifikasi dokumen atau tugas.

Detail matriks izin ada di [[Arsitektur DB & RBAC Matrix]].

## 2. Gateway LLM (Ollama & OpenAI)

NexusFlow memakai pola *adapter* modular. Untuk menjaga kerahasiaan data internal tanpa biaya API cloud, sistem terhubung ke server **Ollama** lokal (\`llama3:latest\`) pada port 11434, dengan OpenAI sebagai alternatif. Spesifikasinya ada di [[Spesifikasi Adapter Ollama]].

## 3. Notula Diskusi & Action Items

- **Sarah**: konfigurasi gateway Ollama lokal dengan fallback timeout 15 detik dan retry otomatis paling lambat ${human(4)}.
- **Dimas**: buat compound index pada tabel \`documents\` dan \`tasks\` untuk optimasi pencarian pada ${human(6)}.
- **Alif**: siapkan panel Related Context di sisi kanan editor sebelum ${human(3)}.`
  );

  await create(
    'Spesifikasi Adapter Ollama',
    'Gateway LLM',
    ['ollama', 'backend'],
    `Kontrak adapter: setiap provider cukup mengimplementasikan \`completeJson(system, prompt)\` dan \`ping()\`.

1. **Ollama** — \`POST /api/generate\` dengan \`format: "json"\`, model default \`llama3:latest\`.
2. **OpenAI** — \`POST /v1/chat/completions\` dengan \`response_format: json_object\`.

Batas waktu 15 detik; bila model tidak merespons, UI menampilkan banner error dan tombol coba lagi. Keputusan desain dibahas di [[Weekly Sync & Sprint 4 Planning]].`,
    ids.sarah
  );

  await create(
    'Sprint 3 Retrospective',
    sprint,
    ['sprint4', 'retro'],
    `Fondasi arsitektur 3-tier berhasil diselesaikan dan pengujian DFD Level 0–2 terverifikasi.

- **Berjalan baik**: migrasi skema Drizzle, seeding data, dan tema ganda.
- **Perlu diperbaiki**: estimasi tugas AI terlalu optimis.

Seluruh temuan integrasi diteruskan ke [[Weekly Sync & Sprint 4 Planning]].`
  );

  await create(
    'Desain Arsitektur SDD',
    'Arsitektur SDD',
    ['architecture', 'ui'],
    `Arsitektur 3-pane: direktori pengetahuan (kiri), editor atau Kanban (tengah), dan laci Related Context (kanan).

> Keterbacaan wajib menang: teks selalu berada di atas permukaan solid.

Model data mengikuti [[Arsitektur DB & RBAC Matrix]].`
  );

  // 4. Tasks
  const seedTasks = [
    { title: 'Desain ERD dan relasi skema MariaDB', status: 'done', priority: 'high', assigneeId: ids.alif, dueDate: day(-3), documentId: weekly },
    { title: 'Implementasi RBAC guard pada Server Actions', status: 'in_progress', priority: 'high', assigneeId: ids.sarah, dueDate: day(2), documentId: weekly },
    { title: 'Koneksi gateway Ollama lokal (/api/ai/extract-actions)', status: 'todo', priority: 'urgent', assigneeId: ids.sarah, dueDate: day(4), documentId: weekly },
    { title: 'Panel Related Context di sisi kanan editor', status: 'todo', priority: 'medium', assigneeId: ids.alif, dueDate: day(3), documentId: weekly },
    { title: 'Index pencarian teks MariaDB untuk Cmd+K', status: 'backlog', priority: 'medium', assigneeId: ids.dimas, dueDate: day(6), documentId: dbDoc },
  ] as const;
  for (const t of seedTasks) await createTask(admin, ids.workspace, t);
  await createTasksBatch(admin, {
    workspaceId: ids.workspace,
    documentId: weekly,
    tasks: [{ title: 'Compound index pada tabel documents & tasks', priority: 'medium', assigneeId: ids.dimas, dueDate: day(6) }],
  });

  const count = await db.select({ id: users.id }).from(users).where(inArray(users.id, Object.values(ids)));
  console.log(`✅ Seed selesai: ${count.length} akun demo (password: ${DEMO_PASSWORD}), workspace "${DEMO_SLUG}".`);
}

if (process.argv[1]?.endsWith('seed.ts')) {
  runSeed({ reset: process.argv.includes('--reset') })
    .then(() => poolConnection.end())
    .catch((err) => {
      console.error('❌ Seeding gagal:', err);
      process.exit(1);
    });
}
