/**
 * Pricing & plan marketing configuration — SINGLE SOURCE OF TRUTH.
 *
 * Every price and plan name rendered anywhere (pricing page, features page,
 * dashboard, billing settings, upgrade modals, blog posts) MUST be imported
 * from this module. Do NOT hardcode "$" figures elsewhere in the codebase.
 *
 * ─── CEO DECISION (2026-09-02) ───────────────────────────────
 *   Free   $0        — 50 docs, 30 chats/day, 1 GB
 *   Pro    $15/mo    — 500 docs, 300 chats/day, 25 GB  ($150/yr ≈ $12.50/mo)
 *   Plus   $25/mo    — unlimited docs & chats, 100 GB  ($250/yr ≈ $20.83/mo)
 */

export type PlanTier = 'free' | 'pro' | 'plus';

export interface PlanInfo {
  id: PlanTier;
  /** Marketing display name. */
  name: string;
  /** Short tagline shown under the plan name. */
  tagline: string;
  /** Monthly price in USD. 0 = free. */
  monthlyPrice: number;
  /** Annual price in USD, billed once per year. 0 = free / N/A. */
  annualPrice: number;
  /** Highlight this card as the most popular option. */
  isPopular?: boolean;
}

export const PLANS: PlanInfo[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'For students and casual learners',
    monthlyPrice: 0,
    annualPrice: 0,
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For power users who need more',
    monthlyPrice: 15,
    annualPrice: 150,
    isPopular: true,
  },
  {
    id: 'plus',
    name: 'Plus',
    tagline: 'For teams and institutions',
    monthlyPrice: 25,
    annualPrice: 250,
  },
];

/** Lookup by tier id. */
export const PLAN_LOOKUP: Record<PlanTier, PlanInfo> = {
  free: PLANS[0],
  pro: PLANS[1],
  plus: PLANS[2],
};

/** Backward-compatible shape used by lib/billing.ts. */
export const PLAN_PRICES: Record<PlanTier, { monthly: number; annual: number }> = {
  free: { monthly: 0, annual: 0 },
  pro: { monthly: 15, annual: 150 },
  plus: { monthly: 25, annual: 250 },
};

/** Resolve a plan by id (lenient about unknown/custom ids). */
export function getPlan(id: string): PlanInfo {
  return PLAN_LOOKUP[id as PlanTier] || PLANS[0];
}

/** "$15" or "Free" / "$0" for free plans. */
export function formatPrice(plan: PlanTier, period: 'monthly' | 'annual' = 'monthly'): string {
  const price = period === 'annual' ? PLAN_PRICES[plan].annual : PLAN_PRICES[plan].monthly;
  if (plan === 'free') return 'Free';
  return `$${price}`;
}

/** "$15/mo" for display next to buttons/badges. */
export function formatMonthly(plan: PlanTier): string {
  if (plan === 'free') return '$0';
  const { monthly } = PLAN_PRICES[plan];
  return `$${monthly}/mo`;
}

/** Per-month equivalent of the annual price (for "Save 17% / ~$12.50/mo" copy). */
export function annualPerMonth(plan: PlanTier): number {
  const { annual } = PLAN_PRICES[plan];
  if (annual <= 0 || plan === 'free') return 0;
  return Math.round((annual / 12) * 100) / 100;
}

/** Percentage saved by paying annually vs monthly (whole %). */
export function annualSavingsPct(plan: PlanTier): number {
  const { monthly, annual } = PLAN_PRICES[plan];
  if (plan === 'free' || monthly <= 0) return 0;
  const monthlyYear = monthly * 12;
  if (monthlyYear <= 0) return 0;
  return Math.round((1 - annual / monthlyYear) * 100);
}