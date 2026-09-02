# NotesChatAI — Payments & Monetization GO-LIVE Checklist

This file is the manual, one-time checklist to switch from "working code" to
"actually collecting money and showing ads." Code is done; these steps require
the account owner (Manav) in the Stripe and Google dashboards.

Status legend: [ ] = not started, [x] = done

---

## 1. Stripe — create the 4 Prices (required for the new monthly/annual pricing)

In the **Stripe Dashboard → Products → Add product**, create these four
recurring ("Subscription") prices. Use any Product names you like; the Price IDs
are what matter.

| Env var (set in Cloudflare)        | Product     | Billing        | Amount |
|------------------------------------|-------------|----------------|--------|
| `STRIPE_PRO_MONTHLY_PRICE_ID`      | Pro         | Monthly        | $2.00  |
| `STRIPE_PRO_ANNUAL_PRICE_ID`       | Pro         | Yearly         | $24.00 |
| `STRIPE_PLUS_MONTHLY_PRICE_ID`     | Plus        | Monthly        | $5.00  |
| `STRIPE_PLUS_ANNUAL_PRICE_ID`      | Plus        | Yearly         | $60.00 |

- [x] Create the 4 prices in Stripe (DONE 2026-09-02, test mode)
- [x] Copy each Price ID (starts with `price_`) — wired into Worker secrets

## 2. Stripe — set the secrets + env vars in Cloudflare (main domain)

Set these on the **production** deployment that serves `noteschatai.com` (Cloudflare
Workers → Settings → Variables and Secrets). Required:

- [x] `STRIPE_SECRET_KEY` — wired (currently **test** key `sk_test_...`; must be swapped for live `sk_live_...`)
- [x] `STRIPE_WEBHOOK_SECRET` (`whsec_...`) — wired
- [x] `STRIPE_PRO_MONTHLY_PRICE_ID` — wired
- [x] `STRIPE_PRO_ANNUAL_PRICE_ID` — wired
- [x] `STRIPE_PLUS_MONTHLY_PRICE_ID` — wired
- [x] `STRIPE_PLUS_ANNUAL_PRICE_ID` — wired

> Secret wiring done 2026-09-02 via `wrangler secret put` into Worker `noteschatai`
> (serves main domain). **Re-wire with live keys after Stripe activation.**

Optional fallback (still supported by code):
- [ ] `STRIPE_PRO_PRICE_ID` / `STRIPE_PLUS_PRICE_ID`

## 3. Stripe — webhook endpoint

- [x] In Stripe Dashboard → Developers → Webhooks → Add endpoint:
      `https://noteschatai.com/api/billing/webhook` (DONE — endpoint `we_1UBJwD...`, status **Active**)
- [x] Subscribe to events: `checkout.session.completed`,
      `customer.subscription.updated`, `customer.subscription.deleted`,
      `invoice.payment_failed` (verified active, all 4 events)
- [x] Copy the **Signing secret** into `STRIPE_WEBHOOK_SECRET` env var

## 4. Stripe — account activation + bank payout (THE MONEY PART)

- [ ] Complete account activation (verify business/identity) — the business shown
      to customers will be **NotesChatAI**
- [ ] Add + verify your **bank account** for payouts (Stripe pays Pro/Plus
      revenue to this account)
- [ ] **Switch from Test → Live mode** (only live mode charges real money and
      pays you)
- [ ] Enable payment methods + countries you accept (cards, Apple/Google Pay,
      and regional methods are auto-offered by Stripe Checkout via
      `payment_method_collection: 'always'` + `automatic_tax`). This is what makes
      "pay from all countries" work.
- [ ] **Enable Stripe Tax** (checkout uses `automatic_tax: { enabled: true }` in
      `src/pages/api/billing/checkout.ts`). If Tax isn't activated, checkout
      session creation fails with an error. Verify under Stripe Dashboard →
      Settings → Tax in each mode (test + live).

## 5. Test a real checkout (Live mode)

- [ ] As a test user, click **Upgrade to Pro** on the pricing page
- [ ] Complete a (small) real Stripe Checkout
- [ ] Verify it redirects back to `/app/settings/billing?success=true`
- [ ] Verify the user's plan becomes `pro` in D1
- [ ] Open **Manage billing** → Stripe Customer Portal works (update card/cancel)
- [ ] Cancel the subscription in the portal → user downgraded to free

## 6. Google AdSense

- [ ] AdSense tag is already live in `Layout.astro` + `AppLayout.astro` (`ca-pub-8713101391590897`)
- [ ] Sign in / apply at https://adsense.google.com with that publisher account
- [ ] Submit the site for review (Google approves manually — ads only appear
      after approval)
- [ ] **Fix the CSP after deploy** (see below) so AdSense quality checks aren't blocked

## 7. D1 database migration

- [x] `billing_period` column added to production `users` table (DONE — applied directly to prod D1 on 2026-09-02, committed as `a34446e`)
      `ALTER TABLE users ADD COLUMN billing_period TEXT DEFAULT 'monthly';`
      ✅ Verified present: `id, email, ..., stripe_customer_id, stripe_subscription_id, subscription_status, chats_used_today, audio_used_today, documents_count, last_usage_reset, billing_period`

## 8. CSP — must be deployed to main domain (DONE)

The code fix is in `src/middleware.ts` (whitelists `static.cloudflareinsights.com`
and the AdSense domain set). Deployed to `noteschatai.com` — zero console errors.

- [x] Deploy the CSP fix to the main domain (DONE 2026-09-02)
- [x] Verify zero CSP console errors on `/pricing` (verified)

> Also fixed 2026-09-02: pricing page annual copy was stale/misleading
> ("50% off yearly ($2/mo → $1/mo)") — corrected to "Pro $24/year ($2/mo)",
> "Plus $60/year ($5/mo)" to match the real Stripe prices. Deployed + verified live.

> **Copy-consistency pass (2026-09-02):** audited every public page for stale pricing
> and aligned all copy to the source of truth (`src/lib/pricing.ts` / `src/lib/billing.ts`):
> - Removed false **"Save 50%"** badge on the Annual pricing toggle (annual = $24/yr = no discount).
> - Homepage + FAQ + JSON-LD: corrected "Pro = unlimited" → **Pro = 500 docs & 300 chats/day**,
>   Plus = unlimited + API access.
> - Features page comparison + free-beta docs: Pro storage **50 GB → 25 GB**.
> All deployed + verified live with zero console errors.

---

## Ownership / accountability
| Item                                  | Owner | Blocked by        |
|---------------------------------------|-------|-------------------|
| 4 Stripe prices + bank + live mode    | Manav | Stripe dashboard  |
| Env vars + webhook                    | Agent | Secrets           |
| AdSense approval                      | Manav | Google review     |
| CSP deploy to main domain             | Agent | ✅ Done 2026-09-02 |
| billing_period migration              | Agent | —                 |
