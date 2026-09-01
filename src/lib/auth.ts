/**
 * Server-side auth helper.
 * Used in Astro pages/layouts to get the current user from the session cookie.
 * Uses D1 directly via cloudflare:workers env.DB for persistent sessions.
 * Falls back to in-memory dev-auth when D1 is unavailable (local dev without workerd).
 */

import { devGetSession } from './dev-auth';

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  plan: string;
}

/**
 * Get the current user from the session cookie.
 * Returns null if not authenticated.
 */
export async function getUser(cookies: {
  get: (name: string) => { value: string } | undefined;
}): Promise<User | null> {
  const sessionToken = cookies.get('session')?.value || cookies.get('better-auth.session_token')?.value;

  if (!sessionToken) {
    return null;
  }

  // Try D1-backed session store (production / cloudflare dev)
  try {
    const { dbGetSession } = await import('./db-auth');
    const result = await dbGetSession(sessionToken);
    if (!result) {
      return null;
    }
    return {
      id: result.session.user.id,
      email: result.session.user.email,
      name: result.session.user.name,
      plan: result.session.user.plan,
      image: result.session.user.image,
    };
  } catch {
    // D1 not available — fall back to in-memory dev-auth
  }

  // Fallback: in-memory dev-auth (local dev without cloudflare workerd)
  try {
    const result = devGetSession(sessionToken);
    if (!result) return null;
    return {
      id: result.session.user.id,
      email: result.session.user.email,
      name: result.session.user.name,
      plan: result.session.user.plan,
    };
  } catch {
    return null;
  }
}

/**
 * Check if the user is authenticated.
 */
export async function isAuthenticated(cookies: {
  get: (name: string) => { value: string } | undefined;
}): Promise<boolean> {
  const user = await getUser(cookies);
  return user !== null;
}
