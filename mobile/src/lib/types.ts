// REST contract of the NexusFlow server (mirrors src/lib/domain.ts in the web app).
export type Role = 'Admin' | 'Editor' | 'Viewer';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type LlmProvider = 'ollama' | 'openai';

export const ROLES: Role[] = ['Admin', 'Editor', 'Viewer'];
export const TASK_STATUSES: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'done'];
export const TASK_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
export const DEFAULT_PROJECT = 'General';
export const ROLE_RANK: Record<Role, number> = { Viewer: 0, Editor: 1, Admin: 2 };
export const atLeast = (role: Role, min: Role) => ROLE_RANK[role] >= ROLE_RANK[min];
export const NEXT_STATUS: Record<TaskStatus, TaskStatus> = { backlog: 'todo', todo: 'in_progress', in_progress: 'done', done: 'todo' };
export const STATUS_LABEL: Record<TaskStatus, string> = { backlog: 'BACKLOG', todo: 'TO_DO', in_progress: 'IN_PROGRESS', done: 'DONE' };
export const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export const formatDue = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
export const isOverdue = (t: { dueDate: string | null; status: TaskStatus }) =>
  !!t.dueDate && t.status !== 'done' && t.dueDate < new Date().toISOString().slice(0, 10);

export interface UserDTO { id: string; name: string; email: string; avatarUrl: string | null }
export interface WorkspaceRefDTO { id: string; name: string; slug: string; role: Role }
export interface MemberDTO { id: string; userId: string; name: string; email: string; role: Role; joinedAt: string }
export interface DocSummaryDTO {
  id: string; title: string; projectName: string; authorId: string; isArchived: boolean; tags: string[]; createdAt: string; updatedAt: string;
}
export interface DocumentDTO extends DocSummaryDTO { content: string; summary: string | null }
export interface TaskDTO {
  id: string; workspaceId: string; title: string; description: string | null; status: TaskStatus; priority: TaskPriority;
  dueDate: string | null; documentId: string | null; assigneeId: string | null; assigneeName: string | null;
  extractedByAi: boolean; createdAt: string; updatedAt: string;
}
export interface RelatedDocDTO { id: string; title: string; projectName: string; score: number; sameProject: boolean; matchedTags: string[]; linked: boolean }
export interface LinkRefDTO { id: string; title: string; anchorText: string | null }
export interface RelatedContextDTO {
  activeDocId: string; ranked: RelatedDocDTO[]; sameProjectDocs: RelatedDocDTO[]; sharedTagDocs: RelatedDocDTO[];
  backlinks: LinkRefDTO[]; outbound: LinkRefDTO[];
  activeTasks: Pick<TaskDTO, 'id' | 'title' | 'status' | 'priority'>[];
  stats: { outbound: number; inbound: number; tasks: number; activeConnections: number };
}
export interface LlmInfoDTO { provider: LlmProvider; model: string; baseUrl: string | null; hasApiKey: boolean }
export interface WorkspaceSnapshotDTO {
  workspace: { id: string; name: string; slug: string; ownerId: string; llm: LlmInfoDTO };
  me: UserDTO; role: Role; effectiveRole: Role; workspaces: WorkspaceRefDTO[]; members: MemberDTO[];
  documents: DocSummaryDTO[]; tags: { id: string; name: string; color: string }[]; tasks: TaskDTO[];
  activeDoc: DocumentDTO | null; context: RelatedContextDTO | null;
}
export interface ActionItemDraftDTO {
  title: string; description: string | null; assigneeHint: string | null; assigneeId: string | null; dueDate: string | null; priority: TaskPriority;
}
export interface SearchResultDTO {
  type: 'note' | 'task' | 'project'; id: string; title: string; snippet: string | null; tags?: string[]; status?: TaskStatus; projectName?: string;
}
export interface Session { token: string; refreshToken: string; expiresIn: number; user: UserDTO }
