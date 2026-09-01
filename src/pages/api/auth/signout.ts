export const prerender = false;
import type { APIRoute } from 'astro';
import { dbDeleteSession } from '../../../lib/db-auth';
import { devDeleteSession } from '../../../lib/dev-auth';

export const POST: APIRoute = async ({ cookies }) => {
  try {
    const sessionToken = cookies.get('session')?.value;

    // Try D1-backed session store first
    try {
      if (sessionToken) await dbDeleteSession(sessionToken);
    } catch {
      // D1 unavailable — fall back to in-memory dev-auth
      if (sessionToken) devDeleteSession(sessionToken);
    }

    cookies.delete('session', { path: '/' });
    cookies.delete('better-auth.session_token', { path: '/' });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Signout error:', error);
    cookies.delete('session', { path: '/' });
    cookies.delete('better-auth.session_token', { path: '/' });
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
