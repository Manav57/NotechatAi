export const prerender = false;

import type { APIRoute } from 'astro';
import { devGetSession } from '../../../lib/dev-auth';
import { getConversation, getConversationMessages, deleteConversation } from '../../../lib/dev-store';

function getUser(cookies: { get: (name: string) => { value: string } | undefined }) {
  const token = cookies.get('session')?.value;
  if (!token) return null;
  const result = devGetSession(token);
  return result?.session?.user || null;
}

// GET /api/chat/:id — get conversation with messages
export const GET: APIRoute = async ({ params, cookies }) => {
  const user = getUser(cookies);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const conv = getConversation(params.id!, user.id);
  if (!conv) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

  const msgs = getConversationMessages(conv.id);
  return new Response(JSON.stringify({ conversation: conv, messages: msgs }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

// DELETE /api/chat/:id — delete conversation
export const DELETE: APIRoute = async ({ params, cookies }) => {
  const user = getUser(cookies);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const deleted = deleteConversation(params.id!, user.id);
  if (!deleted) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
