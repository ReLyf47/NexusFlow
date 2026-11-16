// REST client: Bearer auth, transparent refresh on 401, typed endpoints.
import type {
  ActionItemDraftDTO,
  DocumentDTO,
  LlmInfoDTO,
  LlmProvider,
  MemberDTO,
  RelatedContextDTO,
  Role,
  SearchResultDTO,
  Session,
  TaskDTO,
  TaskPriority,
  TaskStatus,
  UserDTO,
  WorkspaceRefDTO,
  WorkspaceSnapshotDTO,
} from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface Tokens {
  token: string;
  refreshToken: string;
}

export function createApi(opts: { baseUrl: string; getTokens: () => Tokens | null; onTokens: (t: Tokens) => void; onExpired: () => void }) {
  let refreshing: Promise<boolean> | null = null;

  const refresh = () =>
    (refreshing ??= (async () => {
      const tokens = opts.getTokens();
      if (!tokens) return false;
      const res = await fetch(`${opts.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      }).catch(() => null);
      if (!res?.ok) return false;
      const data = (await res.json()) as Session;
      opts.onTokens({ token: data.token, refreshToken: data.refreshToken });
      return true;
    })().finally(() => (refreshing = null)));

  async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
    const token = opts.getTokens()?.token;
    let res: Response;
    try {
      res = await fetch(`${opts.baseUrl}${path}`, {
        method,
        headers: { ...(token && { authorization: `Bearer ${token}` }), ...(body !== undefined && { 'content-type': 'application/json' }) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, `Server ${opts.baseUrl} tidak dapat dihubungi.`);
    }
    if (res.status === 401 && retry && token) {
      if (await refresh()) return request<T>(method, path, body, false);
      opts.onExpired();
    }
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data?.error?.message ?? `HTTP ${res.status}`);
    return data as T;
  }

  const q = (params: Record<string, string | undefined>) => {
    const s = Object.entries(params)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join('&');
    return s ? `?${s}` : '';
  };

  type TaskInput = Partial<Pick<TaskDTO, 'title' | 'description' | 'status' | 'priority' | 'assigneeId' | 'dueDate' | 'documentId'>>;
  type DocResult = { document: DocumentDTO; context: RelatedContextDTO };

  return {
    login: (email: string, password: string) => request<Session>('POST', '/api/auth/login', { email, password }, false),
    register: (name: string, email: string, password: string) =>
      request<Session & { workspace: WorkspaceRefDTO }>('POST', '/api/auth/register', { name, email, password }, false),
    logout: () => request<void>('POST', '/api/auth/logout'),
    me: () => request<{ user: UserDTO; workspaces: WorkspaceRefDTO[] }>('GET', '/api/me'),

    snapshot: (wsId: string) => request<WorkspaceSnapshotDTO>('GET', `/api/workspaces/${wsId}`),
    createWorkspace: (name: string) => request<WorkspaceRefDTO>('POST', '/api/workspaces', { name }),
    inviteMember: (wsId: string, email: string, role: Role) => request<MemberDTO>('POST', `/api/workspaces/${wsId}/members`, { email, role }),
    setMemberRole: (wsId: string, memberId: string, role: Role) => request<MemberDTO>('PATCH', `/api/workspaces/${wsId}/members/${memberId}`, { role }),
    removeMember: (wsId: string, memberId: string) => request<unknown>('DELETE', `/api/workspaces/${wsId}/members/${memberId}`),
    getLlm: (wsId: string) => request<LlmInfoDTO>('GET', `/api/workspaces/${wsId}/llm`),
    setLlm: (wsId: string, body: { provider: LlmProvider; baseUrl?: string; model?: string; apiKey?: string }) =>
      request<LlmInfoDTO>('PUT', `/api/workspaces/${wsId}/llm`, body),

    getDocument: (id: string) => request<DocResult>('GET', `/api/documents/${id}`),
    createDocument: (wsId: string, body: { title: string; content: string; projectName?: string; tags?: string[] }) =>
      request<DocResult>('POST', `/api/workspaces/${wsId}/documents`, body),
    updateDocument: (id: string, patch: { title?: string; content?: string; projectName?: string; tags?: string[]; isArchived?: boolean }) =>
      request<DocResult>('PUT', `/api/documents/${id}`, patch),
    deleteDocument: (id: string, hard: boolean) => request<unknown>('DELETE', `/api/documents/${id}${hard ? '?hard=1' : ''}`),

    createTask: (wsId: string, body: TaskInput) => request<TaskDTO>('POST', `/api/workspaces/${wsId}/tasks`, body),
    updateTask: (id: string, body: TaskInput) => request<TaskDTO>('PUT', `/api/tasks/${id}`, body),
    setTaskStatus: (id: string, status: TaskStatus) => request<TaskDTO>('PATCH', `/api/tasks/${id}/status`, { status }),
    deleteTask: (id: string) => request<unknown>('DELETE', `/api/tasks/${id}`),
    commitTasks: (wsId: string, documentId: string, tasks: { title: string; description: string | null; priority: TaskPriority; assigneeId: string | null; dueDate: string | null }[]) =>
      request<TaskDTO[]>('POST', `/api/workspaces/${wsId}/tasks/batch`, { documentId, tasks }),

    summarize: (documentId: string) => request<{ summary: string[]; engine: string }>('POST', '/api/ai/summarize', { documentId, save: true }),
    extract: (documentId: string) => request<{ actionItems: ActionItemDraftDTO[]; engine: string }>('POST', '/api/ai/extract-actions', { documentId }),
    aiStatus: (wsId: string) => request<{ engine: string; online: boolean }>('GET', `/api/ai/status${q({ workspaceId: wsId })}`),

    search: (wsId: string, query: string, type: string) =>
      request<SearchResultDTO[]>('GET', `/api/workspaces/${wsId}/search${q({ q: query, type })}`),
  };
}

export type Api = ReturnType<typeof createApi>;
