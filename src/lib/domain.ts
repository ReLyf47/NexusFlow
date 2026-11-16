// Pure domain constants & DTO types shared by server, client and REST API.
// Keep this file free of server-only imports so client components can use it.

export const ROLES = ['Admin', 'Editor', 'Viewer'] as const;
export const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const LLM_PROVIDERS = ['ollama', 'openai'] as const;
export const DEFAULT_PROJECT = 'General';

export type Role = (typeof ROLES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export const ROLE_RANK: Record<Role, number> = { Viewer: 0, Editor: 1, Admin: 2 };

export const isRole = (v: unknown): v is Role => ROLES.includes(v as Role);
export const atLeast = (role: Role, min: Role) => ROLE_RANK[role] >= ROLE_RANK[min];

// A role preview can only lower privileges, so honouring it server-side is always safe.
export const effectiveRole = (actual: Role, preview: Role | null | undefined): Role =>
  preview && ROLE_RANK[preview] < ROLE_RANK[actual] ? preview : actual;

// Linear-style cycle used by the status button on cards and inline task rows
export const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  backlog: 'todo',
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

// Round-trip check rejects calendar-invalid dates such as 2026-02-30
export const isValidIsoDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
};

const TAG_PALETTE = ['#FF1A75', '#00F0FF', '#00E5A3', '#FFE600', '#FF8A00', '#7928CA'];
// Deterministic so server-stored and client-derived colours always agree
export const tagColor = (name: string) =>
  TAG_PALETTE[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TAG_PALETTE.length];

export const formatDue = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

export const isOverdue = (task: { dueDate: string | null; status: TaskStatus }) =>
  !!task.dueDate && task.status !== 'done' && task.dueDate < new Date().toLocaleDateString('sv-SE');

export const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: 'BACKLOG',
  todo: 'TO_DO',
  in_progress: 'IN_PROGRESS',
  done: 'DONE',
};

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface WorkspaceRefDTO {
  id: string;
  name: string;
  slug: string;
  role: Role;
}

export interface MemberDTO {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
}

export interface TagDTO {
  id: string;
  name: string;
  color: string;
}

export interface DocSummaryDTO {
  id: string;
  title: string;
  projectName: string;
  authorId: string;
  isArchived: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDTO extends DocSummaryDTO {
  content: string;
  summary: string | null;
}

export interface TaskDTO {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  documentId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  extractedByAi: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RelatedDocDTO {
  id: string;
  title: string;
  projectName: string;
  score: number; // 0..1, SDD 6.1 weighted relevance
  sameProject: boolean;
  matchedTags: string[];
  linked: boolean;
}

export interface LinkRefDTO {
  id: string;
  title: string;
  anchorText: string | null;
}

export interface RelatedContextDTO {
  activeDocId: string;
  ranked: RelatedDocDTO[];
  sameProjectDocs: RelatedDocDTO[];
  sharedTagDocs: RelatedDocDTO[];
  backlinks: LinkRefDTO[];
  outbound: LinkRefDTO[];
  activeTasks: Pick<TaskDTO, 'id' | 'title' | 'status' | 'priority'>[];
  stats: { outbound: number; inbound: number; tasks: number; activeConnections: number };
}

export interface LlmInfoDTO {
  provider: LlmProvider;
  model: string;
  baseUrl: string | null; // Admin only
  hasApiKey: boolean;
}

export interface WorkspaceSnapshotDTO {
  workspace: { id: string; name: string; slug: string; ownerId: string; llm: LlmInfoDTO };
  me: UserDTO;
  role: Role;
  effectiveRole: Role;
  workspaces: WorkspaceRefDTO[];
  members: MemberDTO[];
  documents: DocSummaryDTO[];
  tags: TagDTO[];
  tasks: TaskDTO[];
  activeDoc: DocumentDTO | null;
  context: RelatedContextDTO | null;
}

export interface ActionItemDraftDTO {
  title: string;
  description: string | null;
  assigneeHint: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  priority: TaskPriority;
}

export type SearchType = 'all' | 'notes' | 'tasks' | 'projects';

export interface SearchResultDTO {
  type: 'note' | 'task' | 'project';
  id: string; // project results use the project name as id
  title: string;
  snippet: string | null;
  tags?: string[];
  status?: TaskStatus;
  projectName?: string;
}

// API error envelope shared by Server Actions and REST responses
export interface ApiErrorBody {
  status: number;
  code: string;
  message: string;
  fields?: Record<string, string[] | undefined>;
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ApiErrorBody };
