/**
 * In-memory auth for local development.
 * Only used when WORKER_URL is not set (no Cloudflare Worker running).
 */

import { randomUUID } from 'node:crypto';

// ─── Password hashing — WebCrypto PBKDF2-SHA256 (works in Cloudflare Workers) ───
// Format: pbkdf2:<iterations>:<salt_hex>:<hash_hex>
const PBKDF2_ITERATIONS = 210000;
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

export async function devHashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await pbkdf2Derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${bytesToHex(salt)}:${bytesToHex(key)}`;
}

export async function devVerifyPassword(user: DevUser, password: string): Promise<boolean> {
  if (user.passwordHash.startsWith('pbkdf2:')) {
    const [, iterStr, saltHex, expectedHex] = user.passwordHash.split(':');
    const salt = hexToBytes(saltHex);
    const computed = await pbkdf2Derive(password, salt, parseInt(iterStr, 10) || PBKDF2_ITERATIONS);
    return timingSafeEqualStr(bytesToHex(computed), expectedHex);
  }
  return false; // legacy scrypt/other — force password reset
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
    passwordHash: await devHashPassword(password),
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
