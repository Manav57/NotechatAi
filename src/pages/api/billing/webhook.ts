export const prerender = false;

import type { APIRoute } from 'astro';
import { planFromPriceId } from '../../../lib/billing';

// ─── POST /api/billing/webhook — Stripe Webhook Handler ───

export const POST: APIRoute = async ({ request }) => {
  let env: any;
  try {
    const mod = await import('cloudflare:workers');
    env = (mod as any).env;
  } catch {
    env = null;
  }

  if (!env?.STRIPE_SECRET_KEY || !env?.STRIPE_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Read raw body for signature verification
  const rawBody = await request.text();
  const sigHeader = request.headers.get('stripe-signature');

  if (!sigHeader) {
    return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Import Stripe and verify signature
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-08-27.basil' as any,
  });

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sigHeader,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = env.DB;
  if (!db) {
    console.error('Webhook: D1 database not available');
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(db, event.data.object, env);
        break;
      }

      case 'customer.subscription.updated': {
        await handleSubscriptionUpdated(db, event.data.object, env);
        break;
      }

      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(db, event.data.object);
        break;
      }

      case 'invoice.payment_failed': {
        await handleInvoicePaymentFailed(db, event.data.object, env);
        break;
      }

      default:
        // Unhandled event type — acknowledge receipt
        break;
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err);
    // Return 200 to prevent Stripe retries for processing errors
    // (we've already logged the error)
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// ─── Event Handlers ────────────────────────────────────────

/**
 * checkout.session.completed
 * User completed Stripe Checkout — upgrade their plan.
 */
async function handleCheckoutCompleted(db: any, session: any, env: any) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;

  if (!userId || !plan) {
    console.error('checkout.session.completed: missing metadata', session.id);
    return;
  }

  // Get the subscription ID from the session
  const subscriptionId = session.subscription;
  const customerId = session.customer;

  // Determine plan from the subscription's price ID (authoritative)
  let resolvedPlan = plan;
  let resolvedPeriod = session.metadata?.period || 'monthly';
  if (subscriptionId) {
    const stripe = new (await import('stripe')).default(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil' as any,
    });
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price?.id;
    if (priceId) {
      const mapped = planFromPriceId(priceId, env);
      if (mapped) {
        resolvedPlan = mapped.plan;
        resolvedPeriod = mapped.period;
      }
    }
  }

  // Update user in D1
  await db.prepare(
    `UPDATE users SET
      plan = ?1,
      billing_period = ?2,
      stripe_subscription_id = ?3,
      stripe_customer_id = COALESCE(?4, stripe_customer_id),
      subscription_status = 'active'
    WHERE id = ?5`
  ).bind(resolvedPlan, resolvedPeriod, subscriptionId || null, customerId || null, userId).run();

  console.log(`User ${userId} upgraded to ${resolvedPlan} (${resolvedPeriod}) (checkout.session.completed)`);
}

/**
 * customer.subscription.updated
 * Subscription changed (plan upgrade/downgrade, status change).
 */
async function handleSubscriptionUpdated(db: any, subscription: any, env: any) {
  const subscriptionId = subscription.id;
  const customerId = subscription.customer;
  const status = subscription.status; // active, past_due, canceled, etc.

  // Determine plan from price ID (authoritative — never trust metadata alone)
  const priceId = subscription.items.data[0]?.price?.id;
  let plan = 'free';
  let billingPeriod = 'monthly';
  if (priceId) {
    const mapped = planFromPriceId(priceId, env);
    if (mapped) {
      plan = mapped.plan;
      billingPeriod = mapped.period;
    }
  }

  // Map Stripe status to our status
  let subscriptionStatus = 'active';
  if (status === 'past_due') subscriptionStatus = 'past_due';
  else if (status === 'canceled' || status === 'unpaid') subscriptionStatus = 'canceled';
  else if (status === 'trialing') subscriptionStatus = 'trialing';

  // Find user by stripe_subscription_id or stripe_customer_id
  let user = await db.prepare(
    `SELECT id FROM users WHERE stripe_subscription_id = ?1`
  ).bind(subscriptionId).first();

  if (!user && customerId) {
    user = await db.prepare(
      `SELECT id FROM users WHERE stripe_customer_id = ?1`
    ).bind(customerId).first();
  }

  if (!user) {
    console.error('customer.subscription.updated: user not found for subscription', subscriptionId);
    return;
  }

  await db.prepare(
    `UPDATE users SET
      plan = ?1,
      billing_period = ?2,
      subscription_status = ?3,
      stripe_subscription_id = COALESCE(?4, stripe_subscription_id),
      stripe_customer_id = COALESCE(?5, stripe_customer_id)
    WHERE id = ?6`
  ).bind(plan, billingPeriod, subscriptionStatus, subscriptionId, customerId, user.id).run();

  console.log(`User ${user.id} subscription updated: plan=${plan}, period=${billingPeriod}, status=${subscriptionStatus}`);
}

/**
 * customer.subscription.deleted
 * Subscription canceled — downgrade user to free.
 */
async function handleSubscriptionDeleted(db: any, subscription: any) {
  const subscriptionId = subscription.id;
  const customerId = subscription.customer;

  // Find user
  let user = await db.prepare(
    `SELECT id FROM users WHERE stripe_subscription_id = ?1`
  ).bind(subscriptionId).first();

  if (!user && customerId) {
    user = await db.prepare(
      `SELECT id FROM users WHERE stripe_customer_id = ?1`
    ).bind(customerId).first();
  }

  if (!user) {
    console.error('customer.subscription.deleted: user not found for subscription', subscriptionId);
    return;
  }

  await db.prepare(
    `UPDATE users SET
      plan = 'free',
      billing_period = 'monthly',
      subscription_status = 'canceled',
      stripe_subscription_id = NULL
    WHERE id = ?1`
  ).bind(user.id).run();

  console.log(`User ${user.id} downgraded to free (subscription deleted)`);
}

/**
 * invoice.payment_failed
 * Payment failed — mark subscription as past_due so we can notify/downgrade.
 */
async function handleInvoicePaymentFailed(db: any, invoice: any, env: any) {
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;

  if (!customerId && !subscriptionId) {
    console.error('invoice.payment_failed: no customer or subscription', invoice.id);
    return;
  }

  // Find user
  let user: any = null;
  if (subscriptionId) {
    user = await db.prepare(
      `SELECT id FROM users WHERE stripe_subscription_id = ?1`
    ).bind(subscriptionId).first();
  }
  if (!user && customerId) {
    user = await db.prepare(
      `SELECT id FROM users WHERE stripe_customer_id = ?1`
    ).bind(customerId).first();
  }

  if (!user) {
    console.error('invoice.payment_failed: user not found for customer', customerId);
    return;
  }

  // Mark as past_due — the next subscription.updated webhook from Stripe
  // will handle the actual status transition (active → past_due → canceled)
  await db.prepare(
    `UPDATE users SET subscription_status = 'past_due' WHERE id = ?1 AND subscription_status = 'active'`
  ).bind(user.id).run();

  console.log(`User ${user.id} marked as past_due (invoice.payment_failed)`);
}
