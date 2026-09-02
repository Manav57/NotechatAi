import { Hono } from 'hono';
import { getDb } from '../db';
import { conversations, messages, documents } from '../db/schema';
import { eq, and, desc, count, notInArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

interface Env {
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
  OPENROUTER_API_KEY: string;
}

const chatRoutes = new Hono<{ Bindings: Env }>();

// CTO decision: Using openai/gpt-4o-mini via OpenRouter
// Cost: $0.15/1M input, $0.60/1M output — excellent quality for the price
// Supports function calling and handles RAG context well
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

const CASUAL_SYSTEM_PROMPT = `You are NotesChatAI, a friendly AI study assistant. You help students learn, study, and understand their materials.

You can:
- Answer questions about uploaded documents (PDFs, notes, textbooks)
- Answer questions about handwritten notes that have been scanned and uploaded
- Have casual conversations about any topic
- Help with studying, flashcards, and exam prep
- Explain concepts in simple terms
- Generate study questions and summaries

Be warm, helpful, and conversational. Keep responses concise but thorough. Use markdown formatting when it helps readability.`;

const RAG_SYSTEM_PROMPT = `You are NotesChatAI, an AI study assistant with access to the user's personal knowledge base. This includes uploaded documents AND handwritten notes that have been scanned and converted to text.

When context from documents is provided below, answer based on that context. Cite your sources using the format [Source N] where N matches the context number.

Rules:
- Answer based on the provided context when it's relevant to the question
- If the context doesn't contain the answer, say so honestly — don't make things up
- Be concise but thorough
- Use markdown for formatting when helpful
- If the user asks a casual or off-topic question, respond naturally even if the context is provided
- Never fabricate citations or sources that aren't in the provided context
- If context comes from handwritten notes, you can mention that the source appears to be from handwritten material`;

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

async function userHasDocuments(env: Env, userId: string): Promise<boolean> {
  const db = getDb(env);
  const result = await db.select({ value: count() }).from(documents)
    .where(and(
      eq(documents.userId, userId),
      notInArray(documents.status, ['pending_upload', 'failed']),
    ))
    .get();
  return (result?.value ?? 0) > 0;
}

async function callOpenRouter(
  env: Env,
  messages: Array<{ role: string; content: string }>,
  model = DEFAULT_MODEL,
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
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

// POST /chat - Chat with AI (RAG when documents exist, casual chat otherwise)
chatRoutes.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { message, conversationId, model = DEFAULT_MODEL } = body;

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

  // Check if user has documents for RAG
  let hasDocuments = false;
  let context = '';
  let vectorResults: any[] = [];

  try {
    hasDocuments = await userHasDocuments(c.env, user.id);
  } catch (e) {
    // If query fails, assume no documents
    console.error('Failed to check documents:', e);
  }

  // If user has documents, do RAG
  if (hasDocuments) {
    try {
      const queryEmbedding = await generateEmbedding(c.env, message);
      vectorResults = await searchVectorize(c.env, queryEmbedding, user.id, 10);

      if (vectorResults.length > 0) {
        context = vectorResults
          .map((match, i) => `[Source ${i + 1}] ${match.metadata?.content || '[Content]'}`)
          .join('\n\n');
      }
    } catch (e) {
      // If vector search fails, proceed without RAG
      console.error('Vector search failed:', e);
      hasDocuments = false;
    }
  }

  // Get recent conversation history
  const recentMessages = await db.select().from(messages).where(
    eq(messages.conversationId, conversation.id)
  ).orderBy(desc(messages.createdAt)).limit(10).all();

  const history = recentMessages.reverse().map(m => ({
    role: m.role,
    content: m.content,
  }));

  // Build the message array for OpenRouter
  const fullMessages: Array<{ role: string; content: string }> = [];

  // Choose system prompt based on whether we have document context
  if (context) {
    fullMessages.push({ role: 'system', content: RAG_SYSTEM_PROMPT });
    fullMessages.push({
      role: 'user',
      content: `Context from your knowledge base:\n\n${context}\n\nQuestion: ${message}`,
    });
  } else {
    fullMessages.push({ role: 'system', content: CASUAL_SYSTEM_PROMPT });
    // Add conversation history
    for (const m of history.slice(-8)) {
      fullMessages.push({ role: m.role, content: m.content });
    }
    // Add the current user message
    fullMessages.push({ role: 'user', content: message });
  }

  // Call OpenRouter
  let assistantContent: string;
  try {
    assistantContent = await callOpenRouter(c.env, fullMessages, model);
  } catch (e) {
    console.error('OpenRouter call failed:', e);
    assistantContent = 'I apologize, but I encountered an error processing your request. Please try again.';
  }

  // Save assistant message
  const assistantMessageId = uuidv4();
  await db.insert(messages).values({
    id: assistantMessageId,
    conversationId: conversation.id,
    role: 'assistant',
    content: assistantContent,
    model,
    citations: vectorResults.length > 0
      ? JSON.stringify(vectorResults.map(m => ({ id: m.id, score: m.score })))
      : null,
  });

  // Return JSON response (matches frontend expectations)
  return c.json({
    message: assistantContent,
    conversationId: conversation.id,
    citations: vectorResults.length > 0
      ? vectorResults.map(m => ({
          id: m.id,
          title: m.metadata?.documentId || 'Document',
          score: m.score,
        }))
      : [],
  });
});

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
