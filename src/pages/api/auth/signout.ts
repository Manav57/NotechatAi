export const prerender = false;
import type { APIRoute } from 'astro';
import { devDeleteSession } from '../../../lib/dev-auth';

const WORKER_URL = import.meta.env.WORKER_URL || '';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const sessionToken = cookies.get('session')?.value;

    // Dev mode: invalidate in-memory session
    if (!WORKER_URL) {
      if (sessionToken) devDeleteSession(sessionToken);
    } else {
      // Production: invalidate on worker
      if (sessionToken) {
        await fetch(`${WORKER_URL}/api/auth/signout`, {
          method: 'POST',
          headers: { Cookie: `session=${sessionToken}` },
        }).catch(() => {});
      }
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
