/**
 * Server-side auth helper.
 * Used in Astro pages/layouts to get the current user from the session cookie.
 */

import { devGetSession } from './dev-auth';

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  plan: string;
}

const WORKER_URL = import.meta.env.WORKER_URL || '';

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

  // Dev mode: use in-memory auth
  if (!WORKER_URL) {
    const result = devGetSession(sessionToken);
    if (!result) return null;
    return {
      id: result.session.user.id,
      email: result.session.user.email,
      name: result.session.user.name,
      plan: result.session.user.plan,
    };
  }

  // Production: call worker
  try {
    const response = await fetch(`${WORKER_URL}/api/auth/session`, {
      headers: {
        Cookie: `session=${sessionToken}; better-auth.session_token=${sessionToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.session?.user) {
      return null;
    }

    return {
      id: data.session.user.id,
      email: data.session.user.email,
      name: data.session.user.name || data.session.user.email.split('@')[0],
      image: data.session.user.image,
      plan: data.session.user.plan || 'free',
    };
  } catch (error) {
    console.error('Failed to get user session:', error);
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
