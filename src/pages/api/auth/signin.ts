export const prerender = false;
import type { APIRoute } from 'astro';
import { devGetUserByEmail, devVerifyPassword, devCreateSession } from '../../../lib/dev-auth';

const WORKER_URL = import.meta.env.WORKER_URL || '';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Dev mode: use in-memory auth
    if (!WORKER_URL) {
      const user = devGetUserByEmail(email);
      if (!user || !devVerifyPassword(user, password)) {
        return new Response(
          JSON.stringify({ error: 'Invalid email or password' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const session = devCreateSession(user.id);
      cookies.set('session', session.token, {
        path: '/',
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      });
      return new Response(
        JSON.stringify({ success: true, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Production: proxy to worker
    const response = await fetch(`${WORKER_URL}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: data.error || 'Invalid credentials' }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (data.token) {
      cookies.set('session', data.token, {
        path: '/',
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    const setCookies = response.headers.getSetCookie?.() || [];
    for (const cookie of setCookies) {
      cookies.set(cookie.split('=')[0].trim(), cookie.split('=')[1]?.split(';')[0], {
        path: '/',
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: 'lax',
      });
    }

    return new Response(
      JSON.stringify({ success: true, user: data.user }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Signin error:', error);
    return new Response(
      JSON.stringify({ error: 'Network error. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
