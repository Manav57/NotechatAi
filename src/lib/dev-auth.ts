/**
 * In-memory auth for local development.
 * Only used when WORKER_URL is not set (no Cloudflare Worker running).
 */

import { randomUUID, scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

export interface DevUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  plan: string;
  image?: string;
  createdAt: number;
}

export interface DevSession {
  token: string;
  userId: string;
  expiresAt: number;
}

// In-memory stores
const users = new Map<string, DevUser>();
const sessions = new Map<string, DevSession>();
const emailIndex = new Map<string, string>(); // email → userId

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scryptAsync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })) as Buffer;
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString('hex')}:${key.toString('hex')}`;
}

export async function devVerifyPassword(user: DevUser, password: string): Promise<boolean> {
  if (!user.passwordHash.startsWith('scrypt:')) return false;
  const [, nStr, rStr, pStr, saltHex, hashHex] = user.passwordHash.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const expectedHash = Buffer.from(hashHex, 'hex');
  const key = (await scryptAsync(password, salt, SCRYPT_KEYLEN, { N: parseInt(nStr), r: parseInt(rStr), p: parseInt(pStr) })) as Buffer;
  if (key.length !== expectedHash.length) return false;
  return timingSafeEqual(key, expectedHash);
}

export function devGetUserByEmail(email: string): DevUser | undefined {
  const userId = emailIndex.get(email.toLowerCase());
  if (!userId) return undefined;
  return users.get(userId);
}

export async function devCreateUser(name: string, email: string, password: string): Promise<DevUser> {
  const id = randomUUID();
  const user: DevUser = {
    id,
    email: email.toLowerCase(),
    name,
    passwordHash: await hashPassword(password),
    plan: 'free',
    createdAt: Date.now(),
  };
  users.set(id, user);
  emailIndex.set(user.email, id);
  return user;
}

export function devCreateSession(userId: string): DevSession {
  const token = randomUUID();
  const session: DevSession = {
    token,
    userId,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  sessions.set(token, session);
  return session;
}

export function devGetSession(token: string): { session: { user: DevUser } } | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  const user = users.get(session.userId);
  if (!user) return null;
  return {
    session: {
      user,
    },
  };
}

export function devDeleteSession(token: string): void {
  sessions.delete(token);
}

export function devGetUserById(id: string): DevUser | undefined {
  return users.get(id);
}
