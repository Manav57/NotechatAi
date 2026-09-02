export const prerender = false;

import type { APIRoute } from 'astro';
import { dbGetSession } from '../../../lib/db-auth';
import { devGetSession } from '../../../lib/dev-auth';

// ─── Env bindings ───

async function getEnv() {
  try {
    const mod = await import('cloudflare:workers');
    return (mod as any).env ?? null;
  } catch {
    return null;
  }
}

// ─── Auth helper (D1 session first, dev fallback) — mirrors chat.ts ───

async function getUser(cookies: { get: (name: string) => { value: string } | undefined }) {
  const sessionToken = cookies.get('session')?.value || cookies.get('better-auth.session_token')?.value;
  if (!sessionToken) return null;
  try { const r = await dbGetSession(sessionToken); if (r) return { id: r.session.user.id, email: r.session.user.email, name: r.session.user.name }; } catch {}
  try { const r = devGetSession(sessionToken); if (r) return { id: r.session.user.id, email: r.session.user.email, name: r.session.user.name }; } catch {}
  return null;
}

// ISO timestamp aliases — D1 stores unixepoch() INTEGERs (seconds). SQLite's
// strftime treats bare integers as Julian day numbers, so the 'unixepoch'
// modifier is required or the result is NULL / out-of-range.
const CONV_COLS = `id, user_id, title, model, strftime('%Y-%m-%dT%H:%M:%SZ', created_at, 'unixepoch') AS createdAt, strftime('%Y-%m-%dT%H:%M:%SZ', updated_at, 'unixepoch') AS updatedAt`;

// ─── GET /api/chat/:id — Load a single conversation + messages ───

export const GET: APIRoute = async ({ params, cookies }) => {
  try {
    const user = await getUser(cookies);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

    const bindings = await getEnv();
    if (!bindings) return new Response(JSON.stringify({ error: 'Environment not available' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

    const db = bindings.DB;
    const conv = await db.prepare(`SELECT ${CONV_COLS} FROM conversations WHERE id = ?1 AND user_id = ?2`).bind(params.id, user.id).first();
    if (!conv) return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

    const msgs = await db.prepare(`SELECT id, conversation_id AS conversationId, role, content, model, citations, strftime('%Y-%m-%dT%H:%M:%SZ', created_at, 'unixepoch') AS createdAt FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC`).bind(params.id).all();

    return new Response(JSON.stringify({ conversation: conv, messages: msgs.results || msgs }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('Chat GET single error:', e);
    return new Response(JSON.stringify({ error: 'Internal server error: ' + (e instanceof Error ? e.message : String(e)) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

// ─── DELETE /api/chat/:id — Delete a conversation ───

export const DELETE: APIRoute = async ({ params, cookies }) => {
  try {
    const user = await getUser(cookies);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

    const bindings = await getEnv();
    if (!bindings) return new Response(JSON.stringify({ error: 'Environment not available' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

    const db = bindings.DB;
    const conv = await db.prepare(`SELECT * FROM conversations WHERE id = ?1 AND user_id = ?2`).bind(params.id, user.id).first();
    if (!conv) return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

    await db.prepare(`DELETE FROM messages WHERE conversation_id = ?1`).bind(params.id).run();
    await db.prepare(`DELETE FROM conversations WHERE id = ?1`).bind(params.id).run();
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('Chat DELETE error:', e);
    return new Response(JSON.stringify({ error: 'Internal server error: ' + (e instanceof Error ? e.message : String(e)) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};