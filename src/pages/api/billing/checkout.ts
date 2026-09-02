export const prerender = false;

import type { APIRoute } from 'astro';
import { devGetSession } from '../../../lib/dev-auth';
import { dbGetSession } from '../../../lib/db-auth';
import { getStripePriceId, type PlanTier, type BillingPeriod } from '../../../lib/billing';

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

// ─── POST /api/billing/checkout — Create Stripe Checkout Session ───

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { plan, period = 'monthly' } = body as { plan?: string; period?: string };

    // Validate plan
    if (!plan || !['pro', 'plus'].includes(plan)) {
      return new Response(JSON.stringify({ error: 'Invalid plan. Must be "pro" or "plus".' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate period
    if (!['monthly', 'annual'].includes(period)) {
      return new Response(JSON.stringify({ error: 'Invalid period. Must be "monthly" or "annual".' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if user already has this plan
    if (user.plan === plan) {
      return new Response(JSON.stringify({ error: `You are already on the ${plan} plan.` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    const priceId = getStripePriceId(plan as PlanTier, period as BillingPeriod, env);
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Invalid plan configuration.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Import Stripe
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil' as any,
    });

    // Get or create Stripe customer
    let customerId: string;

    const db = env.DB;
    if (db) {
      // Look up existing Stripe customer ID from D1
      const row = await db.prepare(
        `SELECT stripe_customer_id FROM users WHERE id = ?1`
      ).bind(user.id).first();

      if (row?.stripe_customer_id) {
        customerId = row.stripe_customer_id as string;
      } else {
        // Create new Stripe customer
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: { userId: user.id },
        });
        customerId = customer.id;

        // Save to D1
        await db.prepare(
          `UPDATE users SET stripe_customer_id = ?1 WHERE id = ?2`
        ).bind(customerId, user.id).run();
      }
    } else {
      // No DB available (dev mode) — create ephemeral customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id, devMode: 'true' },
      });
      customerId = customer.id;
    }

    // Create Checkout Session
    const origin = new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/app/settings/billing?success=true`,
      cancel_url: `${origin}/app/settings/billing?canceled=true`,
      subscription_data: {
        metadata: { userId: user.id, plan, period },
      },
      metadata: { userId: user.id, plan, period },
      payment_method_collection: 'always',
      automatic_tax: { enabled: true },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create checkout session. Please try again.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
