/**
 * In-memory auth for local development.
 * Only used when WORKER_URL is not set (no Cloudflare Worker running).
 */

import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';

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

function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'noteschatai-salt').digest('hex');
}

export function devGetUserByEmail(email: string): DevUser | undefined {
  const userId = emailIndex.get(email.toLowerCase());
  if (!userId) return undefined;
  return users.get(userId);
}

export function devCreateUser(name: string, email: string, password: string): DevUser {
  const id = randomUUID();
  const user: DevUser = {
    id,
    email: email.toLowerCase(),
    name,
    passwordHash: hashPassword(password),
    plan: 'free',
    createdAt: Date.now(),
  };
  users.set(id, user);
  emailIndex.set(user.email, id);
  return user;
}

export function devVerifyPassword(user: DevUser, password: string): boolean {
  return user.passwordHash === hashPassword(password);
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
