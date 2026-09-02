export const prerender = false;

import type { APIRoute } from 'astro';
import { devGetSession } from '../../../lib/dev-auth';
import { dbGetSession } from '../../../lib/db-auth';

// ─── Auth helper (D1 sessions first, then in-memory dev-auth) ───

async function getUser(cookies: { get: (name: string) => { value: string } | undefined }) {
  const token = cookies.get('session')?.value;
  if (!token) return null;
  // Production path: D1-backed sessions.
  try {
    const result = await dbGetSession(token);
    if (result) return result.session.user;
  } catch {}
  // Local dev path: in-memory sessions.
  try {
    const result = devGetSession(token);
    return result?.session?.user || null;
  } catch {
    return null;
  }
}

// ─── POST /api/billing/portal — Create Stripe Customer Portal Session ───

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get env bindings
    let env: any;
    try {
      const mod = await import('cloudflare:workers');
      env = (mod as any).env;
    } catch {
      env = null;
    }

    if (!env?.STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({
        error: 'Payment system not configured. Please try again later.',
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get Stripe customer ID from D1
    let customerId: string | null = null;
    const db = env.DB;
    if (db) {
      const row = await db.prepare(
        `SELECT stripe_customer_id FROM users WHERE id = ?1`
      ).bind(user.id).first();
      customerId = row?.stripe_customer_id as string | null;
    }

    if (!customerId) {
      return new Response(JSON.stringify({
        error: 'No billing account found. Subscribe to a plan first.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Import Stripe
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil' as any,
    });

    // Create Customer Portal session
    const origin = new URL(request.url).origin;
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/app/settings/billing`,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Portal error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create portal session. Please try again.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
