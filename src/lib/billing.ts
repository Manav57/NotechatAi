/**
 * Billing & Quota Configuration for NotesChatAI
 *
 * Defines plan tiers, usage quotas, and Stripe integration helpers.
 * Used by API routes, middleware, and webhook handlers.
 */

// ─── Plan Definitions ─────────────────────────────────────

import { PLAN_PRICES, type PlanTier } from './pricing';

// Re-export from the single source of truth (src/lib/pricing.ts).
export { PLAN_PRICES } from './pricing';
export type { PlanTier } from './pricing';

export interface PlanLimits {
  documents: number;      // max documents (-1 = unlimited)
  chatsPerDay: number;    // max chats per day (-1 = unlimited)
  audioPerDay: number;    // max audio overviews per day (-1 = unlimited)
  storageGB: number;      // max storage in GB (-1 = unlimited)
  priorityProcessing: boolean;
  apiAccess: boolean;
  realTimeCollab: boolean;
}

export const PLANS: Record<PlanTier, PlanLimits> = {
  free: {
    documents: 50,
    chatsPerDay: 30,
    audioPerDay: 2,
    storageGB: 1,
    priorityProcessing: false,
    apiAccess: false,
    realTimeCollab: false,
  },
  pro: {
    documents: 500,
    chatsPerDay: 300,
    audioPerDay: 20,
    storageGB: 25,
    priorityProcessing: true,
    apiAccess: false,
    realTimeCollab: false,
  },
  plus: {
    documents: -1,       // unlimited
    chatsPerDay: -1,     // unlimited
    audioPerDay: 100,
    storageGB: 100,
    priorityProcessing: true,
    apiAccess: true,
    realTimeCollab: true,
  },
};

// ─── Quota Helpers ─────────────────────────────────────────

export function getPlanLimits(plan: string): PlanLimits {
  return PLANS[plan as PlanTier] || PLANS.free;
}

export function isUnlimited(value: number): boolean {
  return value === -1;
}

export function hasQuotaRemaining(current: number, limit: number): boolean {
  if (isUnlimited(limit)) return true;
  return current < limit;
}

export function getQuotaRemaining(current: number, limit: number): number {
  if (isUnlimited(limit)) return -1; // unlimited
  return Math.max(0, limit - current);
}

/**
 * Check if daily counters need resetting.
 * Returns true if last_usage_reset is older than UTC midnight today.
 */
export function needsDailyReset(lastReset: string | null): boolean {
  if (!lastReset) return true;
  const lastResetDate = new Date(lastReset);
  const now = new Date();
  // Compare UTC date strings (YYYY-MM-DD)
  const lastResetDay = lastResetDate.toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];
  return lastResetDay !== today;
}

/**
 * Get today's UTC date as ISO string (YYYY-MM-DDTHH:MM:SS.sssZ)
 */
export function getTodayUTC(): string {
  return new Date().toISOString();
}

// ─── Stripe Price ID Mapping ───────────────────────────────

export function getStripePriceId(plan: PlanTier, env: any): string | null {
  if (plan === 'pro') return env.STRIPE_PRO_PRICE_ID || null;
  if (plan === 'plus') return env.STRIPE_PLUS_PRICE_ID || null;
  return null;
}

export function planFromPriceId(priceId: string, env: any): PlanTier | null {
  if (priceId === env.STRIPE_PRO_PRICE_ID) return 'pro';
  if (priceId === env.STRIPE_PLUS_PRICE_ID) return 'plus';
  return null;
}

// ─── Quota Verification ───────────────────────────────────

export type FeatureType = 'chat' | 'document' | 'audio';

export interface QuotaCheckResult {
  allowed: boolean;
  feature: FeatureType;
  plan: PlanTier;
  used: number;
  limit: number;       // -1 = unlimited
  remaining: number;   // -1 = unlimited
  message?: string;
}

/**
 * Verify if a user has quota remaining for a given feature.
 * Automatically resets daily counters if needed.
 *
 * @param db - D1 database binding
 * @param userId - The user's ID
 * @param feature - Which feature to check ('chat' | 'document' | 'audio')
 * @returns QuotaCheckResult with allowed=true/false and usage details
 */
export async function verifyQuota(
  db: any,
  userId: string,
  feature: FeatureType
): Promise<QuotaCheckResult> {
  // Fetch current user state
  const user = await db.prepare(
    `SELECT plan, chats_used_today, audio_used_today, documents_count, last_usage_reset
     FROM users WHERE id = ?1`
  ).bind(userId).first();

  if (!user) {
    return { allowed: false, feature, plan: 'free', used: 0, limit: 0, remaining: 0, message: 'User not found.' };
  }

  const plan = (user.plan as PlanTier) || 'free';
  const limits = getPlanLimits(plan);
  let chatsUsed = (user.chats_used_today as number) || 0;
  let audioUsed = (user.audio_used_today as number) || 0;
  let docCount = (user.documents_count as number) || 0;
  const lastReset = user.last_usage_reset as string | null;

  // Check if daily counters need resetting
  if (needsDailyReset(lastReset)) {
    const today = getTodayUTC();
    await db.prepare(
      `UPDATE users SET chats_used_today = 0, audio_used_today = 0, last_usage_reset = ?1 WHERE id = ?2`
    ).bind(today, userId).run();
    chatsUsed = 0;
    audioUsed = 0;
  }

  // Determine usage and limit for the requested feature
  let used: number;
  let limit: number;

  switch (feature) {
    case 'chat':
      used = chatsUsed;
      limit = limits.chatsPerDay;
      break;
    case 'document':
      used = docCount;
      limit = limits.documents;
      break;
    case 'audio':
      used = audioUsed;
      limit = limits.audioPerDay;
      break;
  }

  const allowed = hasQuotaRemaining(used, limit);
  const remaining = getQuotaRemaining(used, limit);

  let message: string | undefined;
  if (!allowed) {
    message = `Daily ${feature} limit reached for your ${plan} plan. Upgrade for higher limits.`;
  }

  return { allowed, feature, plan, used, limit, remaining, message };
}

/**
 * Increment usage counter for a feature after a successful operation.
 */
export async function incrementUsage(
  db: any,
  userId: string,
  feature: FeatureType
): Promise<void> {
  switch (feature) {
    case 'chat':
      await db.prepare(
        `UPDATE users SET chats_used_today = chats_used_today + 1 WHERE id = ?1`
      ).bind(userId).run();
      break;
    case 'audio':
      await db.prepare(
        `UPDATE users SET audio_used_today = audio_used_today + 1 WHERE id = ?1`
      ).bind(userId).run();
      break;
    case 'document':
      // Documents are counted by actual document count, not increments
      break;
  }
}

/**
 * Increment document count when a new document is created.
 */
export async function incrementDocumentCount(
  db: any,
  userId: string
): Promise<void> {
  await db.prepare(
    `UPDATE users SET documents_count = documents_count + 1 WHERE id = ?1`
  ).bind(userId).run();
}

/**
 * Decrement document count when a document is deleted.
 */
export async function decrementDocumentCount(
  db: any,
  userId: string
): Promise<void> {
  await db.prepare(
    `UPDATE users SET documents_count = MAX(0, documents_count - 1) WHERE id = ?1`
  ).bind(userId).run();
}
