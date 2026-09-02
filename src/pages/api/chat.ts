export const prerender = false;

import type { APIRoute } from 'astro';
import { dbGetSession } from '../../lib/db-auth';
import { devGetSession } from '../../lib/dev-auth';
import { verifyQuota, incrementUsage } from '../../lib/billing';

// ─── Env bindings ───

async function getEnv() {
  try {
    const mod = await import('cloudflare:workers');
    return (mod as any).env ?? null;
  } catch {
    return null;
  }
}

// ─── AI Model ───

const DEFAULT_MODEL = 'openai/gpt-4o-mini';

const CASUAL_SYSTEM_PROMPT = `You are NotesChatAI, a friendly AI study assistant. You help students learn, study, and understand their materials.

You can:
- Answer questions about uploaded documents (PDFs, notes, textbooks)
- Have casual conversations about any topic
- Help with studying, flashcards, and exam prep
- Explain concepts in simple terms
- Generate study questions and summaries

Be warm, helpful, and conversational. Keep responses concise but thorough. Use markdown formatting when it helps readability.`;

const RAG_SYSTEM_PROMPT = `You are NotesChatAI, an AI study assistant with access to the user's personal knowledge base.

When context from documents is provided below, answer based on that context. Cite your sources using the format [Source N] where N matches the context number.

Rules:
- Answer based on the provided context when it's relevant to the question
- If the context doesn't contain the answer, say so honestly — don't make things up
- Be concise but thorough
- Use markdown for formatting when helpful
- If the user asks a casual or off-topic question, respond naturally even if the context is provided
- Never fabricate citations or sources that aren't in the provided context`;

// ─── Helpers ───

async function generateEmbedding(env: any, text: string): Promise<number[]> {
  const result = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [text],
  });
  return result.data[0];
}

async function searchVectorize(env: any, embedding: number[], userId: string, topK = 10) {
  const results = await env.VECTORIZE.query(embedding, {
    topK,
    filter: { userId },
    returnMetadata: true,
    returnValues: false,
  });
  return results.matches;
}

async function userHasDocuments(env: any, userId: string): Promise<boolean> {
  const db = env.DB;
  if (!db) return false;
  const row = await db.prepare(
    `SELECT COUNT(*) as cnt FROM documents WHERE user_id = ?1 AND status NOT IN ('pending_upload', 'failed')`
  ).bind(userId).first();
  return (row?.cnt ?? 0) > 0;
}

async function callOpenRouter(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  model = DEFAULT_MODEL,
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://noteschatai.com',
      'X-Title': 'NotesChatAI',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenRouter API error:', response.status, errorText);
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || 'No response generated.';
}

// ─── Auth helper ───

async function getUser(cookies: { get: (name: string) => { value: string } | undefined }) {
  const sessionToken = cookies.get('session')?.value || cookies.get('better-auth.session_token')?.value;
  if (!sessionToken) return null;

  try {
    const result = await dbGetSession(sessionToken);
    if (result) return { id: result.session.user.id, email: result.session.user.email, name: result.session.user.name };
  } catch {}

  try {
    const result = devGetSession(sessionToken);
    if (result) return { id: result.session.user.id, email: result.session.user.email, name: result.session.user.name };
  } catch {}

  return null;
}

// ─── POST /api/chat — Send a message ───

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
  const user = await getUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const bindings = await getEnv();
  if (!bindings) {
    return new Response(JSON.stringify({ error: 'Environment not available' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { message, conversationId, model = DEFAULT_MODEL } = body;

  if (!message) {
    return new Response(JSON.stringify({ error: 'message required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = bindings.DB;
  const OPENROUTER_API_KEY = bindings.OPENROUTER_API_KEY;

  // ─── Quota enforcement ───
  if (db) {
    const quota = await verifyQuota(db, user.id, 'chat');
    if (!quota.allowed) {
      return new Response(JSON.stringify({
        error: 'QUOTA_EXCEEDED',
        message: quota.message,
        plan: quota.plan,
        feature: quota.feature,
        used: quota.used,
        limit: quota.limit,
        upgradeUrl: '/pricing',
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (!OPENROUTER_API_KEY) {
    return new Response(JSON.stringify({ error: 'OpenRouter API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get or create conversation
  let conv: any;
  if (conversationId) {
    conv = await db.prepare(
      `SELECT * FROM conversations WHERE id = ?1 AND user_id = ?2`
    ).bind(conversationId, user.id).first();
  }

  if (!conv) {
    const newId = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO conversations (id, user_id, title, model, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, unixepoch(), unixepoch())`
    ).bind(newId, user.id, message.slice(0, 50), model).run();
    conv = await db.prepare(`SELECT * FROM conversations WHERE id = ?1`).bind(newId).first();
  }

  // Save user message
  await db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, model, created_at) VALUES (?1, ?2, 'user', ?3, ?4, unixepoch())`
  ).bind(crypto.randomUUID(), conv.id, message, model).run();

  // Check if user has documents for RAG
  let hasDocs = false;
  let context = '';
  let vectorResults: any[] = [];

  try {
    hasDocs = await userHasDocuments(bindings, user.id);
  } catch (e) {
    console.error('Failed to check documents:', e);
  }

  if (hasDocs) {
    try {
      const queryEmbedding = await generateEmbedding(bindings, message);
      vectorResults = await searchVectorize(bindings, queryEmbedding, user.id, 10);
      if (vectorResults.length > 0) {
        context = vectorResults
          .map((match: any, i: number) => `[Source ${i + 1}] ${match.metadata?.content || '[Content]'}`)
          .join('\n\n');
      }
    } catch (e) {
      console.error('Vector search failed:', e);
      hasDocs = false;
    }
  }

  // Get recent conversation history
  const historyResult = await db.prepare(
    `SELECT role, content FROM messages WHERE conversation_id = ?1 ORDER BY created_at DESC LIMIT 10`
  ).bind(conv.id).all();
  const history = (historyResult.results || historyResult).reverse();

  // Build message array for OpenRouter
  const fullMessages: Array<{ role: string; content: string }> = [];

  if (context) {
    fullMessages.push({ role: 'system', content: RAG_SYSTEM_PROMPT });
    fullMessages.push({
      role: 'user',
      content: `Context from your knowledge base:\n\n${context}\n\nQuestion: ${message}`,
    });
  } else {
    fullMessages.push({ role: 'system', content: CASUAL_SYSTEM_PROMPT });
    for (const m of history.slice(-8)) {
      fullMessages.push({ role: m.role, content: m.content });
    }
    fullMessages.push({ role: 'user', content: message });
  }

  // Call OpenRouter
  let assistantContent: string;
  try {
    assistantContent = await callOpenRouter(OPENROUTER_API_KEY, fullMessages, model);
  } catch (e) {
    console.error('OpenRouter call failed:', e);
    assistantContent = 'I apologize, but I encountered an error processing your request. Please try again.';
  }

  // Save assistant message
  await db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, model, citations, created_at) VALUES (?1, ?2, 'assistant', ?3, ?4, ?5, unixepoch())`
  ).bind(
    crypto.randomUUID(),
    conv.id,
    assistantContent,
    model,
    vectorResults.length > 0 ? JSON.stringify(vectorResults.map((m: any) => ({ id: m.id, score: m.score }))) : null,
  ).run();

  // Update conversation timestamp
  await db.prepare(`UPDATE conversations SET updated_at = unixepoch() WHERE id = ?1`).bind(conv.id).run();

  // ─── Increment usage counter ───
  if (db) {
    try { await incrementUsage(db, user.id, 'chat'); } catch {}
  }

  return new Response(JSON.stringify({
    message: assistantContent,
    conversationId: conv.id,
    citations: vectorResults.length > 0
      ? vectorResults.map((m: any) => ({ id: m.id, title: m.metadata?.documentId || 'Document', score: m.score }))
      : [],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  } catch (e) {
    console.error('Chat POST error:', e);
    return new Response(JSON.stringify({ error: 'Internal server error: ' + (e instanceof Error ? e.message : String(e)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// ─── GET /api/chat — List conversations or get single conversation ───

export const GET: APIRoute = async ({ request, cookies }) => {
  const user = await getUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const bindings = await getEnv();
  if (!bindings) {
    return new Response(JSON.stringify({ error: 'Environment not available' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = bindings.DB;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const conversationId = pathParts.length > 2 ? pathParts[2] : null;

  if (conversationId) {
    // GET /api/chat/:id — Get single conversation
    const conv = await db.prepare(
      `SELECT * FROM conversations WHERE id = ?1 AND user_id = ?2`
    ).bind(conversationId, user.id).first();

    if (!conv) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const msgs = await db.prepare(
      `SELECT * FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC`
    ).bind(conversationId).all();

    return new Response(JSON.stringify({ conversation: conv, messages: msgs }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // GET /api/chat — List conversations
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const convs = await db.prepare(
    `SELECT * FROM conversations WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT ?2 OFFSET ?3`
  ).bind(user.id, limit, offset).all();

  return new Response(JSON.stringify({ conversations: convs }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// ─── DELETE /api/chat/:id — Delete a conversation ───

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const user = await getUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const bindings = await getEnv();
  if (!bindings) {
    return new Response(JSON.stringify({ error: 'Environment not available' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = bindings.DB;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const conversationId = pathParts.length > 2 ? pathParts[2] : null;

  if (!conversationId) {
    return new Response(JSON.stringify({ error: 'conversationId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const conv = await db.prepare(
    `SELECT * FROM conversations WHERE id = ?1 AND user_id = ?2`
  ).bind(conversationId, user.id).first();

  if (!conv) {
    return new Response(JSON.stringify({ error: 'Conversation not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await db.prepare(`DELETE FROM messages WHERE conversation_id = ?1`).bind(conversationId).run();
  await db.prepare(`DELETE FROM conversations WHERE id = ?1`).bind(conversationId).run();

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
