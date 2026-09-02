export const prerender = false;

import type { APIRoute } from 'astro';
import { dbGetSession } from '../../../lib/db-auth';
import { devGetSession } from '../../../lib/dev-auth';
import { verifyQuota, incrementDocumentCount } from '../../../lib/billing';
import { getExtension } from '../../../lib/mime-validation';

// ─── Security: MIME-type whitelist & file-size limits ───
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.epub', '.txt', '.md', '.mdx', '.docx', '.doc', '.mp3', '.wav', '.mp4', '.webm', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);
const BLOCKED_EXTENSIONS = new Set(['.exe', '.sh', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif', '.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.vbs', '.vbe', '.wsf', '.wsh', '.ps1', '.psc1', '.psc2', '.reg', '.dll', '.so', '.dylib', '.app', '.deb', '.rpm', '.apk', '.jar', '.class', '.py', '.rb', '.pl', '.php', '.asp', '.aspx', '.jsp', '.cgi']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_REQUEST_SIZE = 15 * 1024 * 1024; // 15 MB (allows base64 overhead)

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

// GET /api/documents — list user documents
export const GET: APIRoute = async ({ cookies, url }) => {
  const user = await getUser(cookies);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  // Try D1 first
  let db: any = null;
  try {
    const mod = await import('cloudflare:workers');
    db = (mod as any).env?.DB ?? null;
  } catch {}

  if (db) {
    try {
      const result = await db.prepare(
        `SELECT id, user_id, title, type, status, metadata, chunk_count, token_count, created_at, updated_at
         FROM documents WHERE user_id = ?1
         ORDER BY created_at DESC LIMIT ?2 OFFSET ?3`
      ).bind(user.id, limit, offset).all();
      const docs = (result.results || result).map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        title: d.title,
        type: d.type,
        status: d.status,
        metadata: d.metadata ? JSON.parse(d.metadata) : {},
        chunkCount: d.chunk_count || 0,
        tokenCount: d.token_count || 0,
        createdAt: d.created_at ? new Date(d.created_at * 1000).toISOString() : null,
        updatedAt: d.updated_at ? new Date(d.updated_at * 1000).toISOString() : null,
      }));
      // Get stats
      const statsRow = await db.prepare(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing
         FROM documents WHERE user_id = ?1`
      ).bind(user.id).first();

      return new Response(JSON.stringify({
        documents: docs,
        stats: {
          totalDocuments: statsRow?.total || 0,
          readyCount: statsRow?.ready || 0,
          processingCount: statsRow?.processing || 0,
        },
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      console.error('D1 document list error:', e);
    }
  }

  // Fallback: empty list (no in-memory fallback for production)
  return new Response(JSON.stringify({ documents: [] }), { headers: { 'Content-Type': 'application/json' } });
};

// POST /api/documents — create/upload a document
export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getUser(cookies);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

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
    if (typeof size === 'number') {
      if (size === 0) {
        return new Response(JSON.stringify({
          error: 'EMPTY_FILE',
          message: 'The file is empty (0 bytes). Please upload a valid file with content.',
        }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (size > MAX_FILE_SIZE) {
        return new Response(JSON.stringify({
          error: 'FILE_TOO_LARGE',
          message: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB. Your file is ${(size / (1024 * 1024)).toFixed(1)} MB.`,
          maxSize: MAX_FILE_SIZE,
          actualSize: size,
          upgradeUrl: '/pricing',
        }), {
          status: 413,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (!filename && !fileUrl) {
      return new Response(JSON.stringify({ error: 'Either filename or url is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate URL is not empty string
    if (fileUrl && fileUrl.trim() === '') {
      return new Response(JSON.stringify({ error: 'URL cannot be empty.' }), {
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

    // Try D1 first
    let db2: any = null;
    try {
      const mod = await import('cloudflare:workers');
      db2 = (mod as any).env?.DB ?? null;
    } catch {}

    let doc: any;
    if (db2) {
      const docId = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);
      const metadata = JSON.stringify({ filename, url: fileUrl, tags: tags || [], size: size || 0 });
      await db2.prepare(
        `INSERT INTO documents (id, user_id, title, type, status, metadata, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'ready', ?5, ?6, ?7)`
      ).bind(docId, user.id, title, type, metadata, now, now).run();
      doc = {
        id: docId,
        userId: user.id,
        title,
        type,
        status: 'ready',
        metadata: { filename, url: fileUrl, tags: tags || [], size: size || 0 },
        chunkCount: 0,
        tokenCount: 0,
        createdAt: new Date(now * 1000).toISOString(),
        updatedAt: new Date(now * 1000).toISOString(),
      };
    } else {
      // Fallback: in-memory dev-store
      const { createDocument } = await import('../../../lib/dev-store');
      doc = createDocument(user.id, title, type, {
        filename,
        url: fileUrl,
        tags: tags || [],
        size: size || 0,
      });
    }

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
