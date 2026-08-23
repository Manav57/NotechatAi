import { Hono } from 'hono';
import { getDb } from '../db';

interface Env {
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
}

const searchRoutes = new Hono<{ Bindings: Env }>();

async function generateEmbedding(env: Env, text: string): Promise<number[]> {
  const result = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [text],
  });
  return result.data[0];
}

// POST /search - Semantic search across knowledge base
searchRoutes.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { query, topK = 10, filter } = body;

  if (!query) {
    return c.json({ error: 'query required' }, 400);
  }

  // 1. Embed query
  const queryEmbedding = await generateEmbedding(c.env, query);

  // 2. Build filter
  const searchFilter: Record<string, any> = { userId: user.id };
  if (filter?.documentIds) {
    searchFilter.documentId = { $in: filter.documentIds };
  }
  if (filter?.type) {
    searchFilter.type = filter.type;
  }
  if (filter?.dateFrom) {
    searchFilter.createdAt = { $gte: filter.dateFrom };
  }

  // 3. Vector search
  const results = await c.env.VECTORIZE.query(queryEmbedding, {
    topK,
    filter: searchFilter,
    returnMetadata: true,
    returnValues: false,
  });

  // 4. Format results
  const formattedResults = results.matches.map((match, index) => ({
    rank: index + 1,
    score: match.score,
    id: match.id,
    documentId: match.metadata?.documentId,
    chunkIndex: match.metadata?.chunkIndex,
    page: match.metadata?.page,
    section: match.metadata?.section,
    content: match.metadata?.content?.slice(0, 500) || '',
    metadata: match.metadata,
  }));

  return c.json({ results: formattedResults, query });
});

// GET /search/suggestions - Search suggestions based on document titles
searchRoutes.get('/suggestions', async (c) => {
  const user = c.get('user');
  const { q } = c.req.query();

  if (!q || q.length < 2) {
    return c.json({ suggestions: [] });
  }

  const db = getDb(c.env);
  // Search document titles
  const docs = await db.select({ id: documents.id, title: documents.title })
    .from(documents)
    .where(/* title LIKE %q% */)
    .limit(5)
    .all();

  return c.json({ suggestions: docs });
});

import { documents } from '../db/schema';
import { like } from 'drizzle-orm';

export default searchRoutes;