export const prerender = false;

import type { APIRoute } from 'astro';
import { devGetSession } from '../../../lib/dev-auth';
import { getDocument, deleteDocument } from '../../../lib/dev-store';
import { decrementDocumentCount } from '../../../lib/billing';

function getUser(cookies: { get: (name: string) => { value: string } | undefined }) {
  const token = cookies.get('session')?.value;
  if (!token) return null;
  const result = devGetSession(token);
  return result?.session?.user || null;
}

// GET /api/documents/:id
export const GET: APIRoute = async ({ params, cookies }) => {
  const user = getUser(cookies);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const doc = getDocument(params.id!, user.id);
  if (!doc) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

  return new Response(JSON.stringify({ document: doc }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

// DELETE /api/documents/:id
export const DELETE: APIRoute = async ({ params, cookies }) => {
  const user = getUser(cookies);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const deleted = deleteDocument(params.id!, user.id);
  if (!deleted) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

  // Decrement document count
  let db: any = null;
  try {
    const mod = await import('cloudflare:workers');
    db = (mod as any).env?.DB ?? null;
  } catch {}
  if (db) {
    try { await decrementDocumentCount(db, user.id); } catch {}
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
