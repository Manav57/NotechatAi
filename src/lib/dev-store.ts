/**
 * In-memory data store for local development.
 * Replaces D1/Vectorize for local dev — production uses Cloudflare Worker.
 */

import { randomUUID } from 'node:crypto';

export interface DevDocument {
  id: string;
  userId: string;
  title: string;
  type: string;
  status: string;
  metadata: Record<string, unknown>;
  chunkCount: number;
  tokenCount: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DevConversation {
  id: string;
  userId: string;
  title: string;
  model: string;
  summary?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DevMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  citations?: string;
  tokensUsed?: number;
  createdAt: number;
}

// In-memory stores
const documents = new Map<string, DevDocument>();
const conversations = new Map<string, DevConversation>();
const messages = new Map<string, DevMessage>();

// ─── Documents ────────────────────────────────────────────

export function createDocument(userId: string, title: string, type: string, metadata: Record<string, unknown> = {}): DevDocument {
  const id = randomUUID();
  const now = Date.now();
  const doc: DevDocument = {
    id, userId, title, type,
    status: 'ready',
    metadata,
    chunkCount: Math.floor(Math.random() * 200) + 10,
    tokenCount: Math.floor(Math.random() * 50000) + 1000,
    createdAt: now, updatedAt: now,
  };
  documents.set(id, doc);
  return doc;
}

export function getUserDocuments(userId: string): DevDocument[] {
  return Array.from(documents.values())
    .filter(d => d.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getDocument(id: string, userId: string): DevDocument | undefined {
  const doc = documents.get(id);
  if (doc && doc.userId === userId) return doc;
  return undefined;
}

export function deleteDocument(id: string, userId: string): boolean {
  const doc = documents.get(id);
  if (!doc || doc.userId !== userId) return false;
  documents.delete(id);
  return true;
}

export function getDocumentCount(userId: string): number {
  return getUserDocuments(userId).length;
}

export function getDocumentStats(userId: string) {
  const docs = getUserDocuments(userId);
  const totalChunks = docs.reduce((sum, d) => sum + d.chunkCount, 0);
  const totalSize = docs.reduce((sum, d) => sum + (d.metadata.size as number || 0), 0);
  return {
    totalDocuments: docs.length,
    totalChunks,
    totalSize,
    readyCount: docs.filter(d => d.status === 'ready').length,
    processingCount: docs.filter(d => d.status === 'processing').length,
    errorCount: docs.filter(d => d.status === 'error').length,
  };
}

// ─── Conversations ────────────────────────────────────────

export function createConversation(userId: string, title: string, model = 'gemini-1.5-flash'): DevConversation {
  const id = randomUUID();
  const now = Date.now();
  const conv: DevConversation = {
    id, userId, title, model, createdAt: now, updatedAt: now,
  };
  conversations.set(id, conv);
  return conv;
}

export function getConversation(id: string, userId: string): DevConversation | undefined {
  const conv = conversations.get(id);
  if (conv && conv.userId === userId) return conv;
  return undefined;
}

export function getUserConversations(userId: string, limit = 20, offset = 0): DevConversation[] {
  return Array.from(conversations.values())
    .filter(c => c.userId === userId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(offset, offset + limit);
}

export function deleteConversation(id: string, userId: string): boolean {
  const conv = conversations.get(id);
  if (!conv || conv.userId !== userId) return false;
  conversations.delete(id);
  // Also delete messages
  for (const [msgId, msg] of messages) {
    if (msg.conversationId === id) messages.delete(msgId);
  }
  return true;
}

export function getConversationCount(userId: string): number {
  return getUserConversations(userId).length;
}

// ─── Messages ─────────────────────────────────────────────

export function createMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string, model?: string, citations?: string): DevMessage {
  const id = randomUUID();
  const now = Date.now();
  const msg: DevMessage = {
    id, conversationId, role, content, model, citations, createdAt: now,
  };
  messages.set(id, msg);

  // Update conversation timestamp
  const conv = conversations.get(conversationId);
  if (conv) {
    conv.updatedAt = now;
    conversations.set(conversationId, conv);
  }

  return msg;
}

export function getConversationMessages(conversationId: string): DevMessage[] {
  return Array.from(messages.values())
    .filter(m => m.conversationId === conversationId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function getMessageCount(userId: string): number {
  const userConvs = getUserConversations(userId, 9999);
  const convIds = new Set(userConvs.map(c => c.id));
  return Array.from(messages.values()).filter(m => convIds.has(m.conversationId)).length;
}

// ─── Search (stub — in production this uses Vectorize) ────

export function searchDocuments(userId: string, query: string): Array<{ doc: DevDocument; score: number; chunk: string }> {
  const docs = getUserDocuments(userId).filter(d => d.status === 'ready');
  return docs.map(doc => ({
    doc,
    score: Math.random() * 0.5 + 0.5,
    chunk: `[From "${doc.title}"] This is a relevant excerpt matching "${query}"...`,
  })).slice(0, 5);
}
