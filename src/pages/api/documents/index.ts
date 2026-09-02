export const prerender = false;

import type { APIRoute } from 'astro';
import { devGetSession } from '../../../lib/dev-auth';
import { getUserDocuments, createDocument, getDocumentStats } from '../../../lib/dev-store';
import { verifyQuota, incrementDocumentCount } from '../../../lib/billing';

// ─── Security: MIME-type whitelist & file-size limits ───
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.epub', '.txt', '.md', '.mdx', '.docx', '.doc', '.mp3', '.wav', '.mp4', '.webm', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);
const BLOCKED_EXTENSIONS = new Set(['.exe', '.sh', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif', '.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.vbs', '.vbe', '.wsf', '.wsh', '.ps1', '.psc1', '.psc2', '.reg', '.dll', '.so', '.dylib', '.app', '.deb', '.rpm', '.apk', '.jar', '.class', '.py', '.rb', '.pl', '.php', '.asp', '.aspx', '.jsp', '.cgi']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function validateFilename(filename: string): { valid: boolean; error?: string } {
  const lower = filename.toLowerCase();
  const ext = '.' + lower.split('.').pop();

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File type "${ext}" is not allowed. Executable and script files are blocked for security.` };
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File type "${ext}" is not supported. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}` };
  }
  // Block path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { valid: false, error: 'Invalid filename.' };
  }
  return { valid: true };
}

function validateUrl(urlStr: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(urlStr);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed.' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL.' };
  }
}

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

  // ─── Quota enforcement ───
  let db: any = null;
  try {
    const mod = await import('cloudflare:workers');
    db = (mod as any).env?.DB ?? null;
  } catch {}
  if (db) {
    const quota = await verifyQuota(db, user.id, 'document');
    if (!quota.allowed) {
      return new Response(JSON.stringify({
        error: 'QUOTA_EXCEEDED',
        message: quota.message,
        plan: quota.plan,
        feature: quota.feature,
        used: quota.used,
        limit: quota.limit,
        upgradeUrl: '/pricing',
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const body = await request.json();
    const { filename, url: fileUrl, tags, size } = body;

    // Validate filename if provided
    if (filename) {
      const validation = validateFilename(filename);
      if (!validation.valid) {
        return new Response(JSON.stringify({ error: validation.error }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Validate URL if provided
    if (fileUrl) {
      const validation = validateUrl(fileUrl);
      if (!validation.valid) {
        return new Response(JSON.stringify({ error: validation.error }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Validate file size (if provided by client)
    if (typeof size === 'number' && size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB.` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!filename && !fileUrl) {
      return new Response(JSON.stringify({ error: 'Either filename or url is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const title = filename || fileUrl || 'Untitled Document';
    const type = title.endsWith('.pdf') ? 'pdf'
      : title.endsWith('.epub') ? 'epub'
      : title.endsWith('.md') || title.endsWith('.mdx') ? 'mdx'
      : title.endsWith('.txt') ? 'txt'
      : title.endsWith('.docx') || title.endsWith('.doc') ? 'docx'
      : title.endsWith('.mp3') || title.endsWith('.wav') ? 'audio'
      : /\.(jpe?g|png|webp|heic|heif)$/i.test(title) ? 'image'
      : 'other';

    const doc = createDocument(user.id, title, type, {
      filename,
      url: fileUrl,
      tags: tags || [],
      size: size || 0,
    });

    // ─── Increment document count ───
    if (db) {
      try { await incrementDocumentCount(db, user.id); } catch {}
    }

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
