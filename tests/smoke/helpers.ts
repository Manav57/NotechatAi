import { request as playwrightRequest } from '@playwright/test';

const BASE = process.env.BASE_URL || 'https://noteschatai.com';

/**
 * Create a unique test user, sign up, and return the session cookie string.
 * Each call creates a fresh user with a timestamped email to avoid collisions.
 */
export async function createTestUser() {
  const ts = Date.now();
  const email = `e2e-test-${ts}@example.com`;
  const password = 'E2ETestPass123!';
  const name = `E2E Test ${ts}`;

  const ctx = await playwrightRequest.newContext({ baseURL: BASE });

  // Sign up — the response sets a Set-Cookie header with the session token
  const signupRes = await ctx.post('/api/auth/signup', {
    data: { name, email, password },
  });

  if (!signupRes.ok()) {
    throw new Error(`Signup failed: ${signupRes.status()} ${await signupRes.text()}`);
  }

  const signupBody = await signupRes.json();
  const userId = signupBody.user?.id;

  // Extract session cookie from Set-Cookie header
  const setCookies = signupRes.headersArray().filter(
    (h) => h.name.toLowerCase() === 'set-cookie'
  );
  const sessionCookie = setCookies
    .map((h) => h.value.split(';')[0]) // take "session=<token>" part only
    .join('; ');

  if (!sessionCookie.includes('session=')) {
    throw new Error('No session cookie received from signup');
  }

  return { email, password, name, userId, sessionCookie, ctx };
}

/**
 * Log in with existing credentials and return the session cookie string.
 */
export async function loginUser(email: string, password: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: BASE });

  const signinRes = await ctx.post('/api/auth/signin', {
    data: { email, password },
  });

  if (!signinRes.ok()) {
    throw new Error(`Login failed: ${signinRes.status()} ${await signinRes.text()}`);
  }

  const setCookies = signinRes.headersArray().filter(
    (h) => h.name.toLowerCase() === 'set-cookie'
  );
  const sessionCookie = setCookies
    .map((h) => h.value.split(';')[0])
    .join('; ');

  return { sessionCookie, ctx };
}

/**
 * Make an authenticated GET request.
 */
export async function authGet(path: string, sessionCookie: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Cookie: sessionCookie },
  });
  return res;
}

/**
 * Make an authenticated POST request.
 */
export async function authPost(path: string, sessionCookie: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

/**
 * Make an authenticated DELETE request.
 */
export async function authDelete(path: string, sessionCookie: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: { Cookie: sessionCookie },
  });
  return res;
}
