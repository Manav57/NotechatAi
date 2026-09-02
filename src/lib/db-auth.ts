/**
 * D1-backed auth for Cloudflare Workers.
 * Uses env.DB from cloudflare:workers directly.
 * Falls back to dev-auth if D1 is unavailable (e.g., local dev without workerd).
 */

import { randomUUID, scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// ─── Password hashing — scrypt with per-user random salt ───
// Format: scrypt:<N>:<r>:<p>:<salt_hex>:<hash_hex>
// N=16384, r=8, p=1 are OWASP recommended defaults for scrypt.

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scryptAsync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })) as Buffer;
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString('hex')}:${key.toString('hex')}`;
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  // Legacy: detect old SHA-256 hashes and reject (force re-hash on next login)
  if (!storedHash.startsWith('scrypt:')) {
    // For backward compat during migration, we can't verify — return false
    // User must reset password. Alternatively, we could keep a legacy check,
    // but that weakens security. Return false to force re-hash.
    return false;
  }
  const [, nStr, rStr, pStr, saltHex, hashHex] = storedHash.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const expectedHash = Buffer.from(hashHex, 'hex');
  const key = (await scryptAsync(password, salt, SCRYPT_KEYLEN, { N: parseInt(nStr), r: parseInt(rStr), p: parseInt(pStr) })) as Buffer;
  if (key.length !== expectedHash.length) return false;
  return timingSafeEqual(key, expectedHash);
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
