import { z } from 'zod';
import { ROLES, TASK_STATUSES, TASK_PRIORITIES, LLM_PROVIDERS, isValidIsoDate } from '@/lib/domain';

const id = (label: string) => z.string().uuid(`${label} tidak valid`);
const isoDate = z.string().refine(isValidIsoDate, 'Tanggal harus berformat YYYY-MM-DD yang valid');
const email = z.string().trim().toLowerCase().email('Format email tidak valid').max(255);

// 1. Auth (FR-AUTH-01..02)
export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100),
  email,
  // bcrypt only uses the first 72 bytes
  password: z.string().min(8, 'Password minimal 8 karakter').max(72, 'Password maksimal 72 karakter'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password wajib diisi').max(72),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(1).optional() });

// 2. Workspace, members, LLM config, projects (FR-AUTH-04, FR-AI-03)
export const workspaceNameSchema = z.object({ name: z.string().trim().min(2, 'Nama workspace minimal 2 karakter').max(120) });

export const inviteMemberSchema = z.object({ email, role: z.enum(ROLES) });
export const memberRoleSchema = z.object({ role: z.enum(ROLES) });

export const llmSettingsSchema = z.object({
  provider: z.enum(LLM_PROVIDERS),
  baseUrl: z
    .string()
    .trim()
    .max(255)
    .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), 'Base URL harus diawali http:// atau https://')
    .optional(),
  model: z.string().trim().max(100).optional(),
  // undefined = keep the stored key, '' = clear it
  apiKey: z.string().trim().max(500).optional(),
});

export const projectRenameSchema = z.object({
  from: z.string().trim().min(1).max(100),
  to: z.string().trim().min(1, 'Nama proyek wajib diisi').max(100),
});

// 3. Documents (FR-NOTE-01..03)
const tagList = z.array(z.string().trim().min(1).max(50)).max(20);

export const createDocumentSchema = z.object({
  workspaceId: id('Workspace ID'),
  title: z.string().trim().min(1, 'Judul dokumen wajib diisi').max(255),
  content: z.string().max(1_000_000).default(''),
  projectName: z.string().trim().min(1).max(100).optional(),
  tags: tagList.optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1, 'Judul dokumen wajib diisi').max(255).optional(),
  content: z.string().max(1_000_000).optional(),
  projectName: z.string().trim().min(1).max(100).optional(),
  tags: tagList.optional(),
  summary: z.string().max(10_000).nullable().optional(),
  isArchived: z.boolean().optional(),
});

// 4. Tasks (FR-TASK-01..03)
const taskFields = {
  title: z.string().trim().min(2, 'Judul tugas minimal 2 karakter').max(255),
  description: z.string().max(10_000).nullable().optional(),
  status: z.enum(TASK_STATUSES).default('todo'),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  assigneeId: id('Assignee ID').nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  documentId: id('Dokumen asal').nullable().optional(),
};

export const createTaskSchema = z.object({ workspaceId: id('Workspace ID'), ...taskFields });

export const updateTaskSchema = z.object({
  title: taskFields.title.optional(),
  description: taskFields.description,
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: taskFields.assigneeId,
  dueDate: taskFields.dueDate,
  documentId: taskFields.documentId,
});

export const updateTaskStatusSchema = z.object({ taskId: id('Task ID'), status: z.enum(TASK_STATUSES) });

export const commitTasksSchema = z.object({
  workspaceId: id('Workspace ID'),
  documentId: id('Dokumen asal'),
  tasks: z
    .array(
      z.object({
        title: taskFields.title,
        description: taskFields.description,
        priority: z.enum(TASK_PRIORITIES).default('medium'),
        assigneeId: taskFields.assigneeId,
        dueDate: taskFields.dueDate,
      })
    )
    .min(1, 'Pilih minimal 1 tugas untuk disinkronkan')
    .max(50),
});

// 5. AI (FR-AI-01..02)
export const summarizeSchema = z.object({
  documentId: id('Dokumen'),
  text: z.string().max(100_000).optional(), // selected passage; whole document when absent
  save: z.boolean().default(true),
});

export const extractSchema = z.object({ documentId: id('Dokumen') });

// 6. Search (FR-SCH-01..04)
export const searchQuerySchema = z.object({
  workspaceId: id('Workspace ID'),
  query: z.string().trim().max(100).default(''),
  type: z.enum(['all', 'notes', 'tasks', 'projects']).default('all'),
  tag: z.string().trim().max(50).optional(),
  status: z.enum(TASK_STATUSES).optional(),
});
