import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

import auth from './routes/auth';
import documents from './routes/documents';
import chat from './routes/chat';
import audio from './routes/audio';
import search from './routes/search';
import health from './routes/health';

interface Env {
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  R2: R2Bucket;
  AI: Ai;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GEMINI_API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('/api/*', cors({
  origin: ['https://noteschatai.com', 'http://localhost:4321'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// Health check
app.route('/api/health', health);

// Auth routes
app.route('/api/auth', auth);

// Protected routes (require authentication)
const protectedRoutes = new Hono<{ Bindings: Env }>();

protectedRoutes.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // TODO: Validate JWT token with Better Auth
  // For now, pass through
  c.set('user', { id: 'demo-user', email: 'demo@noteschatai.com' });
  await next();
});

protectedRoutes.route('/documents', documents);
protectedRoutes.route('/chat', chat);
protectedRoutes.route('/audio', audio);
protectedRoutes.route('/search', search);

app.route('/api', protectedRoutes);

// 404
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;