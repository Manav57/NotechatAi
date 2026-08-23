import { Hono } from 'hono';
import { getDb } from '../db';
import { audioOverviews, documents } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

interface Env {
  DB: D1Database;
  R2: R2Bucket;
  AI: Ai;
  GEMINI_API_KEY: string;
  QUEUE: Queue;
}

const audioRoutes = new Hono<{ Bindings: Env }>();

// POST /audio/generate - Generate audio overview
audioRoutes.post('/generate', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { documentIds, title, voiceConfig } = body;

  if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
    return c.json({ error: 'documentIds array required' }, 400);
  }

  const db = getDb(c.env);

  // Verify documents exist and belong to user
  const docs = await db.select().from(documents).where(
    and(
      inArray(documents.id, documentIds),
      eq(documents.userId, user.id)
    )
  ).all();

  if (docs.length !== documentIds.length) {
    return c.json({ error: 'Some documents not found' }, 404);
  }

  const audioId = uuidv4();
  
  // Create audio overview record
  await db.insert(audioOverviews).values({
    id: audioId,
    userId: user.id,
    documentIds,
    title: title || `Audio Overview - ${new Date().toLocaleDateString()}`,
    status: 'generating',
    voiceConfig: voiceConfig || { voice: 'nova', speed: 1.0 },
  });

  // Send to queue for generation
  await c.env.QUEUE.send({
    audioId,
    documentIds,
    voiceConfig: voiceConfig || { voice: 'nova', speed: 1.0 },
  });

  return c.json({ audioId, status: 'generating' });
});

// GET /audio - List audio overviews
audioRoutes.get('/', async (c) => {
  const user = c.get('user');
  const { limit = '20', offset = '0', status } = c.req.query();

  const db = getDb(c.env);
  let query = db.select().from(audioOverviews).where(
    eq(audioOverviews.userId, user.id)
  ).orderBy(desc(audioOverviews.createdAt)).limit(parseInt(limit)).offset(parseInt(offset));

  if (status) {
    query = query.where(eq(audioOverviews.status, status));
  }

  const audios = await query.all();
  return c.json({ audioOverviews: audios });
});

// GET /audio/:id - Get audio overview details
audioRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const db = getDb(c.env);
  const audio = await db.select().from(audioOverviews).where(
    and(eq(audioOverviews.id, id), eq(audioOverviews.userId, user.id))
  ).get();

  if (!audio) {
    return c.json({ error: 'Audio overview not found' }, 404);
  }

  return c.json({ audioOverview: audio });
});

// GET /audio/:id/stream - Stream audio file
audioRoutes.get('/:id/stream', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const db = getDb(c.env);
  const audio = await db.select().from(audioOverviews).where(
    and(eq(audioOverviews.id, id), eq(audioOverviews.userId, user.id))
  ).get();

  if (!audio || !audio.audioFileKey) {
    return c.json({ error: 'Audio not ready' }, 404);
  }

  const object = await c.env.R2.get(audio.audioFileKey);
  if (!object) {
    return c.json({ error: 'Audio file not found' }, 404);
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': object.size.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000',
    },
  });
});

// GET /audio/:id/transcript - Get transcript
audioRoutes.get('/:id/transcript', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const db = getDb(c.env);
  const audio = await db.select().from(audioOverviews).where(
    and(eq(audioOverviews.id, id), eq(audioOverviews.userId, user.id))
  ).get();

  if (!audio || !audio.transcriptKey) {
    return c.json({ error: 'Transcript not ready' }, 404);
  }

  const object = await c.env.R2.get(audio.transcriptKey);
  if (!object) {
    return c.json({ error: 'Transcript not found' }, 404);
  }

  const transcript = await object.text();
  return c.json({ transcript, chapters: audio.chapters });
});

// DELETE /audio/:id - Delete audio overview
audioRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const db = getDb(c.env);
  const audio = await db.select().from(audioOverviews).where(
    and(eq(audioOverviews.id, id), eq(audioOverviews.userId, user.id))
  ).get();

  if (!audio) {
    return c.json({ error: 'Audio overview not found' }, 404);
  }

  // Delete from R2
  if (audio.audioFileKey) await c.env.R2.delete(audio.audioFileKey);
  if (audio.transcriptKey) await c.env.R2.delete(audio.transcriptKey);

  // Delete from DB
  await db.delete(audioOverviews).where(eq(audioOverviews.id, id));

  return c.json({ success: true });
});

export default audioRoutes;