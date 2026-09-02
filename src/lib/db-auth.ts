/**
 * D1-backed auth for Cloudflare Workers.
 * Uses env.DB from cloudflare:workers directly.
 * Falls back to dev-auth if D1 is unavailable (e.g., local dev without workerd).
 */

import { randomUUID } from 'node:crypto';

// ─── Password hashing — WebCrypto PBKDF2-SHA256 (works in Cloudflare Workers) ───
// New hashes: pbkdf2:<iterations>:<salt_hex>:<hash_hex>
// Legacy scrypt:<...> hashes are still verified for backward compatibility.

// Cloudflare Workers caps WebCrypto PBKDF2 at 100,000 iterations.
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_BITS = 256;

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2Derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    PBKDF2_KEY_BITS
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await pbkdf2Derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${bytesToHex(salt)}:${bytesToHex(key)}`;
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  // New scheme — PBKDF2 (Cloudflare-Workers safe).
  if (storedHash.startsWith('pbkdf2:')) {
    const [, iterStr, saltHex, expectedHex] = storedHash.split(':');
    const salt = hexToBytes(saltHex);
    const computed = await pbkdf2Derive(password, salt, parseInt(iterStr, 10) || PBKDF2_ITERATIONS);
    return timingSafeEqualStr(bytesToHex(computed), expectedHex);
  }

  // Legacy scrypt hashes — verify via node:crypto (with graceful fallback).
  if (storedHash.startsWith('scrypt:')) {
    try {
      const { scrypt, timingSafeEqual } = await import('node:crypto');
      const { promisify } = await import('node:util');
      const scryptAsync = promisify(scrypt) as any;
      const [, nStr, rStr, pStr, saltHex, hashHex] = storedHash.split(':');
      const salt = hexToBytes(saltHex);
      const key = (await scryptAsync(password, salt, 64, {
        N: parseInt(nStr, 10),
        r: parseInt(rStr, 10),
        p: parseInt(pStr, 10),
      } as any)) as Uint8Array;
      const expected = hexToBytes(hashHex);
      if (key.length !== expected.length) return false;
      return timingSafeEqual(Buffer.from(key), Buffer.from(expected));
    } catch {
      return false; // runtime doesn't support scrypt — force password reset
    }
  }

  // Any other legacy hash (e.g. old SHA-256) — cannot verify. Force re-hash.
  return false;
}

// ─── Types ───

export interface DbUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  plan: string;
  image?: string;
  createdAt?: number;
}

export interface DbSession {
  token: string;
  userId: string;
  expiresAt: number;
}

// ─── D1 access (lazy env import) ───

async function getDb(): Promise<any> {
  try {
    const mod = await import('cloudflare:workers');
    return (mod as any).env?.DB ?? null;
  } catch {
    return null;
  }
}

// ─── User operations ───

export async function dbGetUserByEmail(email: string): Promise<DbUser | null> {
  const db = await getDb();
  if (!db) return null;

  const row = await db.prepare(
    `SELECT id, email, name, password_hash AS passwordHash, plan, image, created_at AS createdAt
     FROM users WHERE email = ?1`
  ).bind(email.toLowerCase()).first();

  return row as DbUser | null;
}

export async function dbGetUserById(id: string): Promise<DbUser | null> {
  const db = await getDb();
  if (!db) return null;

  const row = await db.prepare(
    `SELECT id, email, name, password_hash AS passwordHash, plan, image, created_at AS createdAt
     FROM users WHERE id = ?1`
  ).bind(id).first();

  return row as DbUser | null;
}

export async function dbCreateUser(
  name: string,
  email: string,
  password: string
): Promise<DbUser> {
  const db = await getDb();
  if (!db) throw new Error('D1 database not available');

  const id = randomUUID();
  const passwordHash = await hashPassword(password);

  await db.prepare(
    `INSERT INTO users (id, email, name, password_hash, plan)
     VALUES (?1, ?2, ?3, ?4, ?5)`
  ).bind(id, email.toLowerCase(), name, passwordHash, 'free').run();

  return { id, email: email.toLowerCase(), name, passwordHash, plan: 'free' };
}

export async function dbVerifyPassword(user: DbUser, password: string): Promise<boolean> {
  return verifyPassword(user.passwordHash, password);
}

// ─── Session operations ───

export async function dbCreateSession(userId: string): Promise<DbSession> {
  const db = await getDb();
  if (!db) throw new Error('D1 database not available');

  const token = randomUUID();
  const id = randomUUID();
  const expiresAtMs = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  const expiresAt = Math.floor(expiresAtMs / 1000);

  await db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, token)
     VALUES (?1, ?2, ?3, ?4)`
  ).bind(id, userId, expiresAt, token).run();

  return { token, userId, expiresAt: expiresAtMs };
}

export async function dbGetSession(
  token: string
): Promise<{ session: { user: DbUser } } | null> {
  const db = await getDb();
  if (!db) return null;

  const now = Math.floor(Date.now() / 1000);

  const row = await db.prepare(
    `SELECT s.token, s.expires_at AS expiresAt, s.user_id AS userId,
            u.id, u.email, u.name, u.plan, u.image, u.password_hash AS passwordHash
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ?1 AND s.expires_at > ?2`
  ).bind(token, now).first();

  if (!row) return null;

  return {
    session: {
      user: {
        id: row.id as string,
        email: row.email as string,
        name: row.name as string,
        passwordHash: row.passwordHash as string,
        plan: (row.plan as string) || 'free',
        image: (row.image as string) || undefined,
      },
    },
  };
}

export async function dbDeleteSession(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.prepare('DELETE FROM sessions WHERE token = ?1').bind(token).run();
}

// ─── OAuth account operations ───

export async function dbUpsertOAuthAccount(
  userId: string,
  providerId: string,
  accountId: string,
  accessToken?: string,
  refreshToken?: string,
  scope?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Check if account already exists
  const existing = await db.prepare(
    `SELECT id FROM accounts WHERE user_id = ?1 AND provider_id = ?2 AND account_id = ?3`
  ).bind(userId, providerId, accountId).first();

  const now = Math.floor(Date.now() / 1000);

  if (existing) {
    // Update existing account
    await db.prepare(
      `UPDATE accounts SET access_token = ?1, refresh_token = ?2, scope = ?3, updated_at = ?4
       WHERE user_id = ?5 AND provider_id = ?6 AND account_id = ?7`
    ).bind(accessToken || null, refreshToken || null, scope || null, now, userId, providerId, accountId).run();
  } else {
    // Insert new account
    const id = randomUUID();
    await db.prepare(
      `INSERT INTO accounts (id, user_id, provider_id, account_id, access_token, refresh_token, scope, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    ).bind(id, userId, providerId, accountId, accessToken || null, refreshToken || null, scope || null, now, now).run();
  }
}

// ─── Cleanup: delete expired sessions ───

export async function dbCleanExpiredSessions(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = Math.floor(Date.now() / 1000);
  await db.prepare('DELETE FROM sessions WHERE expires_at < ?1').bind(now).run();
}
