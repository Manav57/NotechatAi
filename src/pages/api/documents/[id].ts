export const prerender = false;

import type { APIRoute } from 'astro';
import { dbGetSession } from '../../../lib/db-auth';
import { devGetSession } from '../../../lib/dev-auth';
import { decrementDocumentCount } from '../../../lib/billing';

async function getUser(cookies: { get: (name: string) => { value: string } | undefined }) {
  const token = cookies.get('session')?.value || cookies.get('better-auth.session_token')?.value;
  if (!token) return null;
  // Try D1-backed session first
  try {
    const result = await dbGetSession(token);
    if (result) return { id: result.session.user.id, email: result.session.user.email, name: result.session.user.name };
  } catch {}
  // Fallback to in-memory dev-auth
  try {
    const result = devGetSession(token);
    if (result) return { id: result.session.user.id, email: result.session.user.email, name: result.session.user.name };
  } catch {}
  return null;
}

// GET /api/documents/:id
export const GET: APIRoute = async ({ params, cookies }) => {
  const user = await getUser(cookies);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  // Try D1 first
  let db: any = null;
  try {
    const mod = await import('cloudflare:workers');
    db = (mod as any).env?.DB ?? null;
  } catch {}

  if (db) {
    const row = await db.prepare(
      `SELECT id, user_id, title, type, status, metadata, chunk_count, token_count, created_at, updated_at
       FROM documents WHERE id = ?1 AND user_id = ?2`
    ).bind(params.id, user.id).first();
    if (!row) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ document: {
      id: row.id, userId: row.user_id, title: row.title, type: row.type, status: row.status,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      chunkCount: row.chunk_count || 0, tokenCount: row.token_count || 0,
      createdAt: row.created_at ? new Date(row.created_at * 1000).toISOString() : null,
      updatedAt: row.updated_at ? new Date(row.updated_at * 1000).toISOString() : null,
    }}), { headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
};

// DELETE /api/documents/:id
export const DELETE: APIRoute = async ({ params, cookies }) => {
  const user = await getUser(cookies);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  // Try D1 first
  let db: any = null;
  try {
    const mod = await import('cloudflare:workers');
    db = (mod as any).env?.DB ?? null;
  } catch {}

  let deleted = false;
  if (db) {
    const row = await db.prepare(`SELECT id FROM documents WHERE id = ?1 AND user_id = ?2`).bind(params.id, user.id).first();
    if (!row) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    await db.prepare(`DELETE FROM documents WHERE id = ?1`).bind(params.id).run();
    deleted = true;
  }
  if (!deleted) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  // Decrement document count
  if (db) {
    try { await decrementDocumentCount(db, user.id); } catch {}
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
