export const prerender = false;

import type { APIRoute } from 'astro';
import { devGetSession } from '../../../lib/dev-auth';
import { getUserDocuments, createDocument, getDocumentStats } from '../../../lib/dev-store';

function getUser(cookies: { get: (name: string) => { value: string } | undefined }) {
  const token = cookies.get('session')?.value;
  if (!token) return null;
  const result = devGetSession(token);
  return result?.session?.user || null;
}

// GET /api/documents — list user documents
export const GET: APIRoute = async ({ cookies, url }) => {
  const user = getUser(cookies);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const docs = getUserDocuments(user.id).slice(offset, offset + limit);
  const stats = getDocumentStats(user.id);

  return new Response(JSON.stringify({ documents: docs, stats }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

// POST /api/documents — create/upload a document
export const POST: APIRoute = async ({ request, cookies }) => {
  const user = getUser(cookies);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  try {
    const body = await request.json();
    const { filename, url: fileUrl, tags } = body;

    const title = filename || fileUrl || 'Untitled Document';
    const type = title.endsWith('.pdf') ? 'pdf'
      : title.endsWith('.epub') ? 'epub'
      : title.endsWith('.md') || title.endsWith('.mdx') ? 'mdx'
      : title.endsWith('.txt') ? 'txt'
      : 'other';

    const doc = createDocument(user.id, title, type, {
      filename,
      url: fileUrl,
      tags: tags || [],
      size: body.size || 0,
    });

    return new Response(JSON.stringify({ document: doc }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
