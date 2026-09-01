export const prerender = false;
import type { APIRoute } from 'astro';
import { dbGetUserByEmail, dbCreateUser, dbCreateSession } from '../../../lib/db-auth';
import { devCreateUser, devCreateSession, devGetUserByEmail } from '../../../lib/dev-auth';

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

    // Try D1-backed auth first
    try {
      const existing = await dbGetUserByEmail(email);
      if (existing) {
        return new Response(
          JSON.stringify({ error: 'An account with this email already exists' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const user = await dbCreateUser(name || email.split('@')[0], email, password);
      const session = await dbCreateSession(user.id);
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
    } catch {
      // D1 unavailable — fall back to in-memory dev-auth
    }

    // Fallback: in-memory dev-auth
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
  } catch (error) {
    console.error('Signup error:', error);
    return new Response(
      JSON.stringify({ error: 'Network error. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
