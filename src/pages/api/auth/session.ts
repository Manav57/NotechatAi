export const prerender = false;
import type { APIRoute } from 'astro';
import { devGetSession } from '../../../lib/dev-auth';

const WORKER_URL = import.meta.env.WORKER_URL || '';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const sessionToken = cookies.get('session')?.value || cookies.get('better-auth.session_token')?.value;

    if (!sessionToken) {
      return new Response(
        JSON.stringify({ session: null }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Dev mode: use in-memory auth
    if (!WORKER_URL) {
      const result = devGetSession(sessionToken);
      if (!result) {
        cookies.delete('session', { path: '/' });
        return new Response(
          JSON.stringify({ session: null }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ session: { user: { id: result.session.user.id, email: result.session.user.email, name: result.session.user.name, plan: result.session.user.plan } } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Production: proxy to worker
    const response = await fetch(`${WORKER_URL}/api/auth/session`, {
      headers: {
        Cookie: `session=${sessionToken}; better-auth.session_token=${sessionToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data.session) {
      cookies.delete('session', { path: '/' });
      cookies.delete('better-auth.session_token', { path: '/' });
      return new Response(
        JSON.stringify({ session: null }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ session: data.session }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Session error:', error);
    return new Response(
      JSON.stringify({ session: null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
