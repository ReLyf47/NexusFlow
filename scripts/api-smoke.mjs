// End-to-end REST smoke test against a running NexusFlow server with the demo seed loaded.
// Usage: BASE_URL=http://localhost:3000 node scripts/api-smoke.mjs
// AI checks run only when the workspace's LLM engine is reachable.
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const PASSWORD = 'nexusflow123';
let passed = 0;

async function call(method, path, { token, body, raw } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(token && { authorization: `Bearer ${token}` }), ...(body !== undefined && { 'content-type': 'application/json' }) },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    process.exitCode = 1;
  }
}

const login = async (who) => (await call('POST', '/api/auth/login', { body: { email: `${who}@nexusflow.dev`, password: PASSWORD } })).data;

console.log(`NexusFlow API smoke test → ${BASE}`);

const health = await call('GET', '/api/health');
await check('health reports MariaDB up', () => assert.equal(health.data.db, 'up'));

await check('wrong password → 401', async () => {
  const r = await call('POST', '/api/auth/login', { body: { email: 'alif@nexusflow.dev', password: 'wrong-password' } });
  assert.equal(r.status, 401);
});
await check('malformed JSON → 400', async () => {
  const r = await call('POST', '/api/auth/login', { raw: '{oops' });
  assert.equal(r.status, 400);
});
await check('no token → 401', async () => assert.equal((await call('GET', '/api/me')).status, 401));

const [alif, sarah, rian] = await Promise.all([login('alif'), login('sarah'), login('rian')]);
const me = await call('GET', '/api/me', { token: alif.token });
const ws = me.data.workspaces.find((w) => w.slug === 'nexus-core');
await check('login returns JWT pair + workspaces', () => {
  assert.ok(alif.token && alif.refreshToken && alif.expiresIn === 7200);
  assert.ok(ws, 'demo workspace missing — run bun run db:seed');
});

const snap = (await call('GET', `/api/workspaces/${ws.id}`, { token: sarah.token })).data;
const weekly = snap.documents.find((d) => d.title === 'Weekly Sync & Sprint 4 Planning');
const dbDoc = snap.documents.find((d) => d.title === 'Arsitektur DB & RBAC Matrix');
await check('snapshot has docs, tasks, members, roles', () => {
  assert.equal(snap.role, 'Editor');
  assert.ok(weekly && dbDoc && snap.tasks.length >= 5 && snap.members.length === 4);
  assert.equal(snap.workspace.llm.baseUrl, null, 'non-admins must not see LLM base URL');
});

// ---- RBAC: Viewer is read-only on every mutation (PRD acceptance criterion 1) ----
await check('viewer can read a document', async () => assert.equal((await call('GET', `/api/documents/${weekly.id}`, { token: rian.token })).status, 200));
for (const [label, method, path, body] of [
  ['edit document', 'PUT', `/api/documents/${weekly.id}`, { title: 'hacked' }],
  ['create task', 'POST', `/api/workspaces/${ws.id}/tasks`, { title: 'hack task' }],
  ['change task status', 'PATCH', `/api/tasks/${snap.tasks[0].id}/status`, { status: 'done' }],
  ['run AI summary', 'POST', '/api/ai/summarize', { documentId: weekly.id }],
  ['invite member', 'POST', `/api/workspaces/${ws.id}/members`, { email: 'x@y.dev', role: 'Admin' }],
]) {
  await check(`viewer cannot ${label} → 403`, async () => assert.equal((await call(method, path, { token: rian.token, body })).status, 403));
}
await check('editor cannot change LLM config → 403', async () => {
  assert.equal((await call('PUT', `/api/workspaces/${ws.id}/llm`, { token: sarah.token, body: { provider: 'openai' } })).status, 403);
});

// ---- Notes, wikilinks & related context ----
const created = await call('POST', `/api/workspaces/${ws.id}/documents`, {
  token: sarah.token,
  body: { title: `Smoke Note ${Date.now()}`, content: 'Menautkan [[Weekly Sync & Sprint 4 Planning]] dan `[[Bukan Link]]`.', projectName: 'Sprint 4: Core Engine', tags: ['#Backend', 'smoke'] },
});
await check('editor creates note; tags normalized; wikilink becomes outbound link', () => {
  assert.equal(created.status, 201);
  assert.deepEqual(created.data.document.tags, ['backend', 'smoke']);
  assert.deepEqual(created.data.context.outbound.map((l) => l.title), ['Weekly Sync & Sprint 4 Planning']);
});
await check('target note gets the inbound backlink + scored related context', async () => {
  const ctx = (await call('GET', `/api/documents/${weekly.id}/related-context`, { token: rian.token })).data;
  assert.ok(ctx.backlinks.some((b) => b.id === created.data.document.id));
  const hit = ctx.ranked.find((r) => r.id === created.data.document.id);
  assert.ok(hit.sameProject && hit.linked && hit.score > 0.65, JSON.stringify(hit));
});
await check('editor cannot create a new project → 403; admin can', async () => {
  const body = { title: 'Proj test', content: '', projectName: `New Project ${Date.now()}` };
  assert.equal((await call('POST', `/api/workspaces/${ws.id}/documents`, { token: sarah.token, body })).status, 403);
  const ok = await call('POST', `/api/workspaces/${ws.id}/documents`, { token: alif.token, body });
  assert.equal(ok.status, 201);
  await call('DELETE', `/api/documents/${ok.data.document.id}?hard=1`, { token: alif.token });
});
await check("editor cannot delete someone else's note → 403", async () => {
  assert.equal((await call('DELETE', `/api/documents/${weekly.id}`, { token: sarah.token })).status, 403);
});
await check('editor archives own note, then hard-deletes it; backlink disappears', async () => {
  assert.equal((await call('DELETE', `/api/documents/${created.data.document.id}`, { token: sarah.token })).status, 200);
  const ctx = (await call('GET', `/api/documents/${weekly.id}/related-context`, { token: sarah.token })).data;
  assert.ok(!ctx.backlinks.some((b) => b.id === created.data.document.id));
  assert.equal((await call('DELETE', `/api/documents/${created.data.document.id}?hard=1`, { token: sarah.token })).status, 200);
});

// ---- Tasks ----
const sarahId = snap.members.find((m) => m.name === 'Sarah Wijaya').userId;
const task = await call('POST', `/api/workspaces/${ws.id}/tasks`, {
  token: sarah.token,
  body: { title: 'Smoke task', priority: 'high', assigneeId: sarahId, dueDate: '2026-12-01', documentId: weekly.id },
});
await check('task CRUD + status cycle', async () => {
  assert.equal(task.status, 201);
  assert.equal(task.data.assigneeName, 'Sarah Wijaya');
  assert.equal((await call('PATCH', `/api/tasks/${task.data.id}/status`, { token: sarah.token, body: { status: 'in_progress' } })).data.status, 'in_progress');
  assert.equal((await call('PUT', `/api/tasks/${task.data.id}`, { token: sarah.token, body: { priority: 'urgent' } })).data.priority, 'urgent');
  assert.equal((await call('DELETE', `/api/tasks/${task.data.id}`, { token: sarah.token })).status, 200);
});
await check('invalid date / foreign assignee rejected → 400', async () => {
  const bad = await call('POST', `/api/workspaces/${ws.id}/tasks`, { token: sarah.token, body: { title: 'Bad date', dueDate: '2026-02-30' } });
  assert.equal(bad.status, 400);
  const foreign = await call('POST', `/api/workspaces/${ws.id}/tasks`, { token: sarah.token, body: { title: 'Foreign', assigneeId: '99999999-0000-4000-8000-000000000000' } });
  assert.equal(foreign.status, 400);
});

// ---- Search ----
await check('search finds notes, tasks, projects; LIKE wildcards are literal', async () => {
  const r = (await call('GET', `/api/workspaces/${ws.id}/search?q=ollama`, { token: rian.token })).data;
  assert.ok(r.some((x) => x.type === 'note') && r.some((x) => x.type === 'task'));
  const p = (await call('GET', `/api/workspaces/${ws.id}/search?q=sprint&type=projects`, { token: rian.token })).data;
  assert.ok(p.some((x) => x.type === 'project'));
  assert.equal((await call('GET', `/api/workspaces/${ws.id}/search?q=%25%25`, { token: rian.token })).data.length, 0);
});

// ---- AI (only if the engine answers) ----
const ai = (await call('GET', `/api/ai/status?workspaceId=${ws.id}`, { token: sarah.token })).data;
if (ai.online) {
  await check('AI summary returns bullets', async () => {
    const r = await call('POST', '/api/ai/summarize', { token: sarah.token, body: { documentId: weekly.id, save: false } });
    assert.equal(r.status, 200);
    assert.ok(r.data.summary.length >= 1);
  });
  await check('AI extraction returns validated drafts; batch commit marks extractedByAi', async () => {
    const r = await call('POST', '/api/ai/extract-actions', { token: sarah.token, body: { documentId: weekly.id } });
    assert.equal(r.status, 200);
    for (const d of r.data.actionItems) {
      assert.ok(['low', 'medium', 'high', 'urgent'].includes(d.priority));
      assert.ok(d.dueDate === null || /^\d{4}-\d{2}-\d{2}$/.test(d.dueDate));
    }
    const commit = await call('POST', `/api/workspaces/${ws.id}/tasks/batch`, { token: sarah.token, body: { documentId: weekly.id, tasks: r.data.actionItems } });
    assert.equal(commit.status, 201);
    assert.ok(commit.data.every((t) => t.extractedByAi && t.documentId === weekly.id));
    for (const t of commit.data) await call('DELETE', `/api/tasks/${t.id}`, { token: sarah.token });
  });
} else {
  console.log(`  - AI checks skipped (${ai.engine} offline)`);
}

// ---- Tenancy, refresh & revocation ----
const stranger = await call('POST', '/api/auth/register', { body: { name: 'Smoke Stranger', email: `stranger${Date.now()}@test.dev`, password: 'stranger-pass-1' } });
await check('new account gets its own workspace and cannot see the demo one → 404', async () => {
  assert.equal(stranger.status, 201);
  assert.equal(stranger.data.workspace.role, 'Admin');
  assert.equal((await call('GET', `/api/workspaces/${ws.id}`, { token: stranger.data.token })).status, 404);
  assert.equal((await call('GET', `/api/documents/${weekly.id}`, { token: stranger.data.token })).status, 404);
});
await check('refresh issues a new access token; logout revokes all tokens', async () => {
  const r = await call('POST', '/api/auth/refresh', { body: { refreshToken: stranger.data.refreshToken } });
  assert.equal(r.status, 200);
  assert.equal((await call('POST', '/api/auth/logout', { token: r.data.token })).status, 204);
  assert.equal((await call('GET', '/api/me', { token: r.data.token })).status, 401);
  assert.equal((await call('POST', '/api/auth/refresh', { body: { refreshToken: stranger.data.refreshToken } })).status, 401);
});

console.log(`\n${passed} checks passed${process.exitCode ? ', some FAILED' : ''}.`);
