export const prerender = false;
import type { APIRoute } from 'astro';
import { dbGetUserByEmail, dbVerifyPassword, dbCreateSession } from '../../../lib/db-auth';
import { devGetUserByEmail, devVerifyPassword, devCreateSession } from '../../../lib/dev-auth';

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

    // Try D1-backed auth first
    try {
      const user = await dbGetUserByEmail(email);
      if (!user || !(await dbVerifyPassword(user, password))) {
        return new Response(
          JSON.stringify({ error: 'Invalid email or password' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
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
  } catch (error) {
    console.error('Signin error:', error);
    return new Response(
      JSON.stringify({ error: 'Network error. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
