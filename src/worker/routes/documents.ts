import { Hono } from 'hono';
import { getDb } from '../db';
import { documents } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

interface Env {
  DB: D1Database;
  R2: R2Bucket;
}

const documentsRoutes = new Hono<{ Bindings: Env }>();

// Get presigned upload URL
documentsRoutes.post('/upload', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { filename, contentType, size } = body;

  if (!filename || !contentType) {
    return c.json({ error: 'filename and contentType required' }, 400);
  }

  // Validate file type
  const allowedTypes = [
    'application/pdf',
    'application/epub+zip',
    'text/plain',
    'text/markdown',
    'audio/mpeg',
    'audio/wav',
    'video/mp4',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ];
  
  if (!allowedTypes.includes(contentType) && !filename.endsWith('.pdf') && !filename.endsWith('.epub')) {
    return c.json({ error: 'Unsupported file type' }, 400);
  }

  // Validate file size (max 100MB)
  if (size && size > 100 * 1024 * 1024) {
    return c.json({ error: 'File too large (max 100MB)' }, 400);
  }

  const documentId = uuidv4();
  const key = `users/${user.id}/${documentId}/${filename}`;

  // Generate presigned URL for R2 upload
  const url = await c.env.R2.createPresignedPutUrl(key, {
    expiresIn: 3600, // 1 hour
  });

  // Create document record
  const db = getDb(c.env);
  await db.insert(documents).values({
    id: documentId,
    userId: user.id,
    title: filename,
    type: contentType === 'application/pdf' ? 'pdf' : 
          contentType === 'application/epub+zip' ? 'epub' :
          contentType.startsWith('image/') ? 'image' : 'other',
    originalFileKey: key,
    status: 'pending_upload',
    metadata: { filename, contentType, size },
  });

  return c.json({
    uploadUrl: url,
    key,
    documentId,
    expiresIn: 3600,
  });
});

// Confirm upload and start processing
documentsRoutes.post('/:id/confirm', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const db = getDb(c.env);
  const doc = await db.select().from(documents).where(
    and(eq(documents.id, id), eq(documents.userId, user.id))
  ).get();

  if (!doc) {
    return c.json({ error: 'Document not found' }, 404);
  }

  if (doc.status !== 'pending_upload') {
    return c.json({ error: 'Document already processed or failed' }, 400);
  }

  // Update status to processing
  await db.update(documents).set({
    status: 'processing',
    updatedAt: new Date(),
  }).where(eq(documents.id, id));

  // Send to processing queue
  await c.env.QUEUE.send({
    documentId: id,
    key: doc.originalFileKey,
    type: doc.type,
  });

  return c.json({ success: true, documentId: id });
});

// List documents
documentsRoutes.get('/', async (c) => {
  const user = c.get('user');
  const { limit = '20', offset = '0', status } = c.req.query();

  const db = getDb(c.env);
  const query = db.select().from(documents)
    .where(eq(documents.userId, user.id))
    .orderBy(desc(documents.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  if (status) {
    query.where(eq(documents.status, status));
  }

  const docs = await query.all();

  return c.json({ documents: docs });
});

// Get document details
documentsRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const db = getDb(c.env);
  const doc = await db.select().from(documents).where(
    and(eq(documents.id, id), eq(documents.userId, user.id))
  ).get();

  if (!doc) {
    return c.json({ error: 'Document not found' }, 404);
  }

  return c.json({ document: doc });
});

// Delete document
documentsRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const db = getDb(c.env);
  const doc = await db.select().from(documents).where(
    and(eq(documents.id, id), eq(documents.userId, user.id))
  ).get();

  if (!doc) {
    return c.json({ error: 'Document not found' }, 404);
  }

  // Delete from R2
  if (doc.originalFileKey) {
    await c.env.R2.delete(doc.originalFileKey);
  }
  if (doc.extractedTextKey) {
    await c.env.R2.delete(doc.extractedTextKey);
  }

  // Delete from Vectorize (by metadata filter)
  await c.env.VECTORIZE.deleteByMetadata({
    documentId: id,
  });

  // Delete from DB
  await db.delete(documents).where(eq(documents.id, id));

  return c.json({ success: true });
});

export default documentsRoutes;