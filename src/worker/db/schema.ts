import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  name: text('name'),
  passwordHash: text('password_hash'),
  image: text('image'),
  plan: text('plan').default('free').notNull(),
  settings: text('settings', { mode: 'json' }),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
}));

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').unique().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('sessions_user_id_idx').on(table.userId),
  tokenIdx: index('sessions_token_idx').on(table.token),
}));

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('accounts_user_id_idx').on(table.userId),
}));

export const verifications = sqliteTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (table) => ({
  identifierIdx: index('verifications_identifier_idx').on(table.identifier),
}));

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  originalFileKey: text('original_file_key'),
  extractedTextKey: text('extracted_text_key'),
  metadata: text('metadata', { mode: 'json' }),
  status: text('status').default('processing').notNull(),
  chunkCount: integer('chunk_count').default(0),
  tokenCount: integer('token_count').default(0),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('documents_user_id_idx').on(table.userId),
  statusIdx: index('documents_status_idx').on(table.status),
}));

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  title: text('title'),
  model: text('model'),
  systemPrompt: text('system_prompt'),
  summary: text('summary'),
  summaryEmbedding: text('summary_embedding', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('conversations_user_id_idx').on(table.userId),
}));

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').references(() => conversations.id).notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  citations: text('citations', { mode: 'json' }),
  model: text('model'),
  tokensUsed: integer('tokens_used'),
  latencyMs: integer('latency_ms'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (table) => ({
  conversationIdIdx: index('messages_conversation_id_idx').on(table.conversationId),
}));

export const audioOverviews = sqliteTable('audio_overviews', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  documentIds: text('document_ids', { mode: 'json' }).notNull(),
  title: text('title'),
  status: text('status').default('generating').notNull(),
  audioFileKey: text('audio_file_key'),
  transcriptKey: text('transcript_key'),
  chapters: text('chapters', { mode: 'json' }),
  durationSeconds: integer('duration_seconds'),
  voiceConfig: text('voice_config', { mode: 'json' }),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('audio_overviews_user_id_idx').on(table.userId),
  statusIdx: index('audio_overviews_status_idx').on(table.status),
}));

export const mindMaps = sqliteTable('mind_maps', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  documentIds: text('document_ids', { mode: 'json' }).notNull(),
  nodes: text('nodes', { mode: 'json' }).notNull(),
  edges: text('edges', { mode: 'json' }).notNull(),
  clusters: text('clusters', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('mind_maps_user_id_idx').on(table.userId),
}));

export const flashcards = sqliteTable('flashcards', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  documentIds: text('document_ids', { mode: 'json' }),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  type: text('type').notNull(),
  difficulty: integer('difficulty').default(0),
  stability: integer('stability').default(0),
  dueDate: integer('due_date', { mode: 'timestamp' }),
  lastReviewed: integer('last_reviewed', { mode: 'timestamp' }),
  reviewCount: integer('review_count').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('flashcards_user_id_idx').on(table.userId),
  dueDateIdx: index('flashcards_due_date_idx').on(table.dueDate),
}));

export const quizzes = sqliteTable('quizzes', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  documentIds: text('document_ids', { mode: 'json' }),
  questions: text('questions', { mode: 'json' }).notNull(),
  score: integer('score'),
  totalQuestions: integer('total_questions'),
  timeSpentMs: integer('time_spent_ms'),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('quizzes_user_id_idx').on(table.userId),
}));