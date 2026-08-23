import { Hono } from 'hono';
import { getDb } from '../db';
import { conversations, messages, documents } from '../db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

interface Env {
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
  GEMINI_API_KEY: string;
}

const chatRoutes = new Hono<{ Bindings: Env }>();

const RAG_SYSTEM_PROMPT = `You are NotesChatAI, an AI study assistant with access to the user's personal knowledge base. 
Answer questions based ONLY on the provided context from their documents.
Always cite your sources using the format [doc_id:chunk_index].
If the context doesn't contain the answer, say so honestly.
Be concise but thorough. Use markdown for formatting.`;

async function generateEmbedding(env: Env, text: string): Promise<number[]> {
  const result = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [text],
  });
  return result.data[0];
}

async function searchVectorize(env: Env, embedding: number[], userId: string, topK = 10) {
  const results = await env.VECTORIZE.query(embedding, {
    topK,
    filter: { userId },
    returnMetadata: true,
    returnValues: false,
  });
  return results.matches;
}

// POST /chat - Streaming chat with RAG
chatRoutes.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { message, conversationId, model = 'gemini-1.5-flash', retrieval = { topK: 10, rerank: true } } = body;

  if (!message) {
    return c.json({ error: 'message required' }, 400);
  }

  const db = getDb(c.env);

  // Get or create conversation
  let conversation;
  if (conversationId) {
    conversation = await db.select().from(conversations).where(
      and(eq(conversations.id, conversationId), eq(conversations.userId, user.id))
    ).get();
  }

  if (!conversation) {
    const newConversationId = uuidv4();
    await db.insert(conversations).values({
      id: newConversationId,
      userId: user.id,
      title: message.slice(0, 50),
      model,
    });
    conversation = await db.select().from(conversations).where(eq(conversations.id, newConversationId)).get();
  }

  // Save user message
  const userMessageId = uuidv4();
  await db.insert(messages).values({
    id: userMessageId,
    conversationId: conversation.id,
    role: 'user',
    content: message,
    model,
  });

  // 1. Embed query
  const queryEmbedding = await generateEmbedding(c.env, message);

  // 2. Vector search
  const vectorResults = await searchVectorize(c.env, queryEmbedding, user.id, retrieval.topK);

  // 3. Build context from vector results
  const context = vectorResults
    .map((match, i) => `[${i + 1}] ${match.metadata?.content || '[Content]'}`)
    .join('\n\n');

  // 4. Get recent conversation history
  const recentMessages = await db.select().from(messages).where(
    eq(messages.conversationId, conversation.id)
  ).orderBy(desc(messages.createdAt)).limit(10).all();

  const history = recentMessages.reverse().map(m => ({
    role: m.role,
    content: m.content,
  }));

  // 5. Build full message array
  const fullMessages = [
    { role: 'system', content: RAG_SYSTEM_PROMPT },
    ...history.slice(-6),
    { role: 'user', content: `Context from your knowledge base:\n\n${context}\n\nQuestion: ${message}` },
  ];

  // 6. Stream response from Gemini
  const stream = await callGeminiStream(c.env, fullMessages, model);

  // Save assistant message placeholder
  const assistantMessageId = uuidv4();
  await db.insert(messages).values({
    id: assistantMessageId,
    conversationId: conversation.id,
    role: 'assistant',
    content: '',
    model,
    citations: JSON.stringify(vectorResults.map(m => ({ id: m.id, score: m.score }))),
  });

  // Return streaming response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Conversation-Id': conversation.id,
      'X-Message-Id': assistantMessageId,
    },
  });
});

async function callGeminiStream(env: Env, messages: Array<{ role: string; content: string }>, model = 'gemini-1.5-flash') {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: 0.3,
          topP: 0.9,
          maxOutputTokens: 4096,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  return response.body;
}

// GET /chat/:id - Get conversation
chatRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const db = getDb(c.env);
  const conversation = await db.select().from(conversations).where(
    and(eq(conversations.id, id), eq(conversations.userId, user.id))
  ).get();

  if (!conversation) {
    return c.json({ error: 'Conversation not found' }, 404);
  }

  const msgs = await db.select().from(messages).where(
    eq(messages.conversationId, id)
  ).orderBy(messages.createdAt).all();

  return c.json({ conversation, messages: msgs });
});

// GET /chat - List conversations
chatRoutes.get('/', async (c) => {
  const user = c.get('user');
  const { limit = '20', offset = '0' } = c.req.query();

  const db = getDb(c.env);
  const convs = await db.select().from(conversations).where(
    eq(conversations.userId, user.id)
  ).orderBy(desc(conversations.updatedAt)).limit(parseInt(limit)).offset(parseInt(offset)).all();

  return c.json({ conversations: convs });
});

// DELETE /chat/:id - Delete conversation
chatRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const db = getDb(c.env);
  const conversation = await db.select().from(conversations).where(
    and(eq(conversations.id, id), eq(conversations.userId, user.id))
  ).get();

  if (!conversation) {
    return c.json({ error: 'Conversation not found' }, 404);
  }

  await db.delete(messages).where(eq(messages.conversationId, id));
  await db.delete(conversations).where(eq(conversations.id, id));

  return c.json({ success: true });
});

export default chatRoutes;