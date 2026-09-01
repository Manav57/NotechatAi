export const prerender = false;
import type { APIRoute } from 'astro';
import { dbGetSession } from '../../../lib/db-auth';
import { devGetSession } from '../../../lib/dev-auth';

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const sessionToken = cookies.get('session')?.value || cookies.get('better-auth.session_token')?.value;

    if (!sessionToken) {
      return new Response(
        JSON.stringify({ session: null }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Try D1-backed session store first
    try {
      const result = await dbGetSession(sessionToken);
      if (!result) {
        cookies.delete('session', { path: '/' });
        return new Response(
          JSON.stringify({ session: null }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          session: {
            user: {
              id: result.session.user.id,
              email: result.session.user.email,
              name: result.session.user.name,
              plan: result.session.user.plan,
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch {
      // D1 unavailable — fall back to in-memory dev-auth
    }

    const result = devGetSession(sessionToken);
    if (!result) {
      cookies.delete('session', { path: '/' });
      return new Response(
        JSON.stringify({ session: null }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        session: {
          user: {
            id: result.session.user.id,
            email: result.session.user.email,
            name: result.session.user.name,
            plan: result.session.user.plan,
          },
        },
      }),
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
