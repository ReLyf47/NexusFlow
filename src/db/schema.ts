import {
  mysqlTable,
  varchar,
  text,
  longtext,
  timestamp,
  boolean,
  mysqlEnum,
  date,
  int,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { ROLES, TASK_STATUSES, TASK_PRIORITIES, LLM_PROVIDERS, DEFAULT_PROJECT } from '../lib/domain';

// 1. Users (D1) — role lives on workspace_members, not here
export const users = mysqlTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 72 }).notNull(),
  avatarUrl: text('avatar_url'),
  // Bumped on logout: every JWT carrying an older version is rejected server-side
  tokenVersion: int('token_version').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Workspaces (D2) — includes the Admin-managed LLM configuration (FR-AI-03)
export const workspaces = mysqlTable('workspaces', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  ownerId: varchar('owner_id', { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  llmProvider: mysqlEnum('llm_provider', LLM_PROVIDERS).default('ollama').notNull(),
  llmBaseUrl: varchar('llm_base_url', { length: 255 }),
  llmModel: varchar('llm_model', { length: 100 }),
  llmApiKey: text('llm_api_key'), // AES-256-GCM ciphertext; never sent to clients
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Workspace Members (RBAC junction)
export const workspaceMembers = mysqlTable(
  'workspace_members',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    workspaceId: varchar('workspace_id', { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: mysqlEnum('role', ROLES).default('Editor').notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (t) => ({
    workspaceUserIdx: uniqueIndex('workspace_user_idx').on(t.workspaceId, t.userId),
  })
);

// 4. Documents (D4) — Markdown notes grouped by project_name
export const documents = mysqlTable(
  'documents',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    workspaceId: varchar('workspace_id', { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    authorId: varchar('author_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 255 }).notNull(),
    content: longtext('content').notNull(),
    summary: text('summary'),
    projectName: varchar('project_name', { length: 100 }).default(DEFAULT_PROJECT).notNull(),
    isArchived: boolean('is_archived').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    docWsProjIdx: index('doc_ws_proj_idx').on(t.workspaceId, t.projectName),
  })
);

// 5. Tasks (D5) — Kanban items, optionally born from a document (originDocId)
export const tasks = mysqlTable(
  'tasks',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    workspaceId: varchar('workspace_id', { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    documentId: varchar('document_id', { length: 36 }).references(() => documents.id, {
      onDelete: 'set null',
    }),
    assigneeId: varchar('assignee_id', { length: 36 }).references(() => users.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    status: mysqlEnum('status', TASK_STATUSES).default('todo').notNull(),
    priority: mysqlEnum('priority', TASK_PRIORITIES).default('medium').notNull(),
    dueDate: date('due_date', { mode: 'string' }),
    extractedByAi: boolean('extracted_by_ai').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    taskWsStatusIdx: index('task_ws_status_idx').on(t.workspaceId, t.status),
  })
);

// 6. Tags
export const tags = mysqlTable(
  'tags',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    workspaceId: varchar('workspace_id', { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 50 }).notNull(),
    color: varchar('color', { length: 20 }).default('#FF1A75').notNull(),
  },
  (t) => ({
    tagWsNameIdx: uniqueIndex('tag_ws_name_idx').on(t.workspaceId, t.name),
  })
);

// 7. Document Tags (M:N junction)
export const documentTags = mysqlTable(
  'document_tags',
  {
    documentId: varchar('document_id', { length: 36 })
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    tagId: varchar('tag_id', { length: 36 })
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.documentId, t.tagId] }),
  })
);

// 8. Document Links — derived from [[wikilinks]] on every save
export const documentLinks = mysqlTable(
  'document_links',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    sourceDocId: varchar('source_doc_id', { length: 36 })
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    targetDocId: varchar('target_doc_id', { length: 36 })
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    anchorText: varchar('anchor_text', { length: 100 }),
  },
  (t) => ({
    docLinkIdx: uniqueIndex('doc_link_idx').on(t.sourceDocId, t.targetDocId),
  })
);

// ==========================================
// RELATION DEFINITIONS
// ==========================================

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(workspaceMembers),
  assignedTasks: many(tasks),
  documents: many(documents),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  members: many(workspaceMembers),
  documents: many(documents),
  tasks: many(tasks),
  tags: many(tags),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceMembers.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [workspaceMembers.userId], references: [users.id] }),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [documents.workspaceId], references: [workspaces.id] }),
  author: one(users, { fields: [documents.authorId], references: [users.id] }),
  tasks: many(tasks),
  tags: many(documentTags),
  outboundLinks: many(documentLinks, { relationName: 'outbound' }),
  inboundLinks: many(documentLinks, { relationName: 'inbound' }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  workspace: one(workspaces, { fields: [tasks.workspaceId], references: [workspaces.id] }),
  document: one(documents, { fields: [tasks.documentId], references: [documents.id] }),
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id] }),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [tags.workspaceId], references: [workspaces.id] }),
  documents: many(documentTags),
}));

export const documentTagsRelations = relations(documentTags, ({ one }) => ({
  document: one(documents, { fields: [documentTags.documentId], references: [documents.id] }),
  tag: one(tags, { fields: [documentTags.tagId], references: [tags.id] }),
}));

export const documentLinksRelations = relations(documentLinks, ({ one }) => ({
  sourceDoc: one(documents, {
    fields: [documentLinks.sourceDocId],
    references: [documents.id],
    relationName: 'outbound',
  }),
  targetDoc: one(documents, {
    fields: [documentLinks.targetDocId],
    references: [documents.id],
    relationName: 'inbound',
  }),
}));
