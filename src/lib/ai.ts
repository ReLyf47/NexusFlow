// AI Automation Gateway (SDD 6.2, NFR-MOD-02). A provider only has to implement
// LlmAdapter; summarize/extract are provider-agnostic and validate model output.
import { z } from 'zod';
import { AppError } from './errors';
import { isValidIsoDate, type ActionItemDraftDTO, type LlmProvider, type TaskPriority } from './domain';

export interface LlmConfig {
  provider: LlmProvider;
  baseUrl: string;
  model: string;
  apiKey: string | null;
}

export interface LlmAdapter {
  readonly label: string;
  completeJson(system: string, prompt: string): Promise<unknown>;
  ping(): Promise<boolean>;
}

const TIMEOUT_MS = 15_000; // NFR-PERF-03
const MAX_INPUT_CHARS = 24_000;

export function resolveLlmConfig(
  ws: { llmProvider: LlmProvider; llmBaseUrl: string | null; llmModel: string | null },
  apiKey: string | null
): LlmConfig {
  const trim = (u: string) => u.replace(/\/+$/, '');
  if (ws.llmProvider === 'openai') {
    return { provider: 'openai', baseUrl: trim(ws.llmBaseUrl || 'https://api.openai.com/v1'), model: ws.llmModel || 'gpt-4o-mini', apiKey };
  }
  return {
    provider: 'ollama',
    baseUrl: trim(ws.llmBaseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434'),
    model: ws.llmModel || process.env.OLLAMA_MODEL || 'llama3:latest',
    apiKey: null,
  };
}

function offlineMessage(cfg: LlmConfig) {
  if (cfg.provider === 'openai') return `Endpoint OpenAI (${cfg.baseUrl}) tidak dapat dihubungi.`;
  let host = cfg.baseUrl;
  try {
    host = new URL(cfg.baseUrl).host;
  } catch {}
  return `Layanan Ollama lokal (${host}) tidak merespons. Pastikan perintah \`ollama run ${cfg.model.split(':')[0]}\` aktif di terminal Anda.`;
}

async function postJson(cfg: LlmConfig, url: string, body: unknown, headers: Record<string, string> = {}) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') {
      throw new AppError(504, 'AI_TIMEOUT', `Model ${cfg.model} tidak merespons dalam 15 detik. Silakan coba lagi.`);
    }
    throw new AppError(502, 'AI_OFFLINE', offlineMessage(cfg));
  }
  if (!res.ok) {
    const hint = res.status === 401 ? ' — API key ditolak' : res.status === 404 ? ` — model "${cfg.model}" tidak ditemukan` : '';
    throw new AppError(502, 'AI_UPSTREAM', `${cfg.provider.toUpperCase()} mengembalikan HTTP ${res.status}${hint}.`);
  }
  return res.json() as Promise<Record<string, any>>;
}

function parseModelJson(text: unknown): unknown {
  if (typeof text !== 'string' || !text.trim()) throw new AppError(502, 'AI_BAD_RESPONSE', 'Respons model kosong.');
  try {
    return JSON.parse(text);
  } catch {
    const block = text.match(/\{[\s\S]*\}/); // some models wrap JSON in prose
    if (block) {
      try {
        return JSON.parse(block[0]);
      } catch {}
    }
    throw new AppError(502, 'AI_BAD_RESPONSE', 'Model tidak mengembalikan JSON yang valid. Silakan coba lagi.');
  }
}

const ollamaAdapter = (cfg: LlmConfig): LlmAdapter => ({
  label: `OLLAMA // ${cfg.model.toUpperCase()}`,
  async completeJson(system, prompt) {
    const data = await postJson(cfg, `${cfg.baseUrl}/api/generate`, {
      model: cfg.model,
      system,
      prompt,
      format: 'json',
      stream: false,
      options: { temperature: 0.2 },
    });
    return parseModelJson(data.response);
  },
  async ping() {
    try {
      return (await fetch(`${cfg.baseUrl}/api/tags`, { signal: AbortSignal.timeout(2500) })).ok;
    } catch {
      return false;
    }
  },
});

const openAiAdapter = (cfg: LlmConfig): LlmAdapter => ({
  label: `OPENAI // ${cfg.model.toUpperCase()}`,
  async completeJson(system, prompt) {
    if (!cfg.apiKey) throw new AppError(400, 'AI_NOT_CONFIGURED', 'API key OpenAI belum diatur oleh Admin workspace.');
    const data = await postJson(
      cfg,
      `${cfg.baseUrl}/chat/completions`,
      {
        model: cfg.model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      },
      { authorization: `Bearer ${cfg.apiKey}` }
    );
    return parseModelJson(data.choices?.[0]?.message?.content);
  },
  async ping() {
    if (!cfg.apiKey) return false;
    try {
      const res = await fetch(`${cfg.baseUrl}/models`, {
        headers: { authorization: `Bearer ${cfg.apiKey}` },
        signal: AbortSignal.timeout(4000),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
});

export const createAdapter = (cfg: LlmConfig): LlmAdapter =>
  cfg.provider === 'openai' ? openAiAdapter(cfg) : ollamaAdapter(cfg);

// ---------- Use cases ----------

const clip = (s: string) => (s.length > MAX_INPUT_CHARS ? `${s.slice(0, MAX_INPUT_CHARS)}\n…` : s);

const summarySchema = z.object({ summary: z.array(z.string()).min(1) });

export async function summarize(adapter: LlmAdapter, text: string): Promise<string[]> {
  const raw = await adapter.completeJson(
    'Anda adalah asisten dokumentasi teknis. Ringkas teks menjadi 3-6 poin eksekutif yang singkat dan faktual, dalam bahasa yang sama dengan teks. Balas HANYA JSON valid: {"summary": ["poin 1", "poin 2"]}.',
    `Teks:\n${clip(text)}`
  );
  const parsed = summarySchema.safeParse(raw);
  if (!parsed.success) throw new AppError(502, 'AI_BAD_RESPONSE', 'Format ringkasan dari model tidak sesuai.');
  const bullets = parsed.data.summary.map((s) => s.trim()).filter(Boolean).slice(0, 8);
  if (!bullets.length) throw new AppError(502, 'AI_BAD_RESPONSE', 'Model mengembalikan ringkasan kosong.');
  return bullets;
}

const rawItemsSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string().nullish(),
      description: z.string().nullish(),
      assignee: z.string().nullish(),
      dueDate: z.string().nullish(),
      priority: z.string().nullish(),
    })
  ),
});

type RawItem = z.infer<typeof rawItemsSchema>['tasks'][number];
interface MemberLite {
  id: string;
  name: string;
}

const PRIORITY_ALIASES: Record<string, TaskPriority> = {
  low: 'low',
  rendah: 'low',
  normal: 'medium',
  medium: 'medium',
  sedang: 'medium',
  high: 'high',
  tinggi: 'high',
  urgent: 'urgent',
  critical: 'urgent',
  mendesak: 'urgent',
};

export const normalizePriority = (p: string | null | undefined): TaskPriority =>
  PRIORITY_ALIASES[String(p ?? '').trim().toLowerCase()] ?? 'medium';

export function matchMember(hint: string, members: MemberLite[]): string | null {
  const h = hint.trim().toLowerCase();
  const first = (s: string) => s.trim().toLowerCase().split(/\s+/)[0];
  const hit =
    members.find((m) => m.name.toLowerCase() === h) ??
    members.find((m) => first(m.name) === first(h)) ??
    (h.length >= 3 ? members.find((m) => m.name.toLowerCase().includes(h)) : undefined);
  return hit?.id ?? null;
}

export function normalizeActionItem(item: RawItem, members: MemberLite[]): ActionItemDraftDTO | null {
  const title = item.title?.trim().slice(0, 255);
  if (!title || title.length < 2) return null;
  const hint = item.assignee?.trim() || null;
  const due = item.dueDate?.trim() ?? '';
  return {
    title,
    description: item.description?.trim() || null,
    assigneeHint: hint,
    assigneeId: hint ? matchMember(hint, members) : null,
    dueDate: isValidIsoDate(due) ? due : null,
    priority: normalizePriority(item.priority),
  };
}

export async function extractActionItems(
  adapter: LlmAdapter,
  text: string,
  members: MemberLite[],
  today = new Date()
): Promise<ActionItemDraftDTO[]> {
  const raw = await adapter.completeJson(
    [
      'Anda adalah asisten manajemen proyek teknis. Ekstrak seluruh action items eksplisit dari notula.',
      `Hari ini: ${today.toLocaleDateString('sv-SE')}. Anggota tim: ${members.map((m) => m.name).join(', ') || '-'}.`,
      'Balas HANYA JSON valid dengan schema: {"tasks": [{"title": string, "description": string, "assignee": string|null, "dueDate": "YYYY-MM-DD"|null, "priority": "low"|"medium"|"high"|"urgent"}]}.',
      'Jika tidak ada action item, balas {"tasks": []}.',
    ].join(' '),
    `Notula:\n${clip(text)}`
  );
  const parsed = rawItemsSchema.safeParse(raw);
  if (!parsed.success) throw new AppError(502, 'AI_BAD_RESPONSE', 'Format action items dari model tidak sesuai.');
  return parsed.data.tasks
    .map((t) => normalizeActionItem(t, members))
    .filter((t): t is ActionItemDraftDTO => t !== null)
    .slice(0, 30);
}
