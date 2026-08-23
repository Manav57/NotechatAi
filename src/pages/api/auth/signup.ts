export const prerender = false;
import type { APIRoute } from 'astro';
import { devCreateUser, devCreateSession, devGetUserByEmail } from '../../../lib/dev-auth';

const WORKER_URL = import.meta.env.WORKER_URL || '';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Dev mode: use in-memory auth
    if (!WORKER_URL) {
      if (devGetUserByEmail(email)) {
        return new Response(
          JSON.stringify({ error: 'An account with this email already exists' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const user = devCreateUser(name || email.split('@')[0], email, password);
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
    const response = await fetch(`${WORKER_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: data.error || 'Signup failed' }),
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
    console.error('Signup error:', error);
    return new Response(
      JSON.stringify({ error: 'Network error. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
