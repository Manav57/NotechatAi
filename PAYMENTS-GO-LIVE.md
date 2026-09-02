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
| `STRIPE_PRO_ANNUAL_PRICE_ID`       | Pro         | Yearly         | $12.00 |
| `STRIPE_PLUS_MONTHLY_PRICE_ID`     | Plus        | Monthly        | $5.00  |
| `STRIPE_PLUS_ANNUAL_PRICE_ID`      | Plus        | Yearly         | $60.00 |

- [ ] Create the 4 prices in Stripe
- [ ] Copy each Price ID (starts with `price_`)

## 2. Stripe — set the secrets + env vars in Cloudflare (main domain)

Set these on the **production** deployment that serves `noteschatai.com` (Cloudflare
Workers → Settings → Variables and Secrets). Required:

- [ ] `STRIPE_SECRET_KEY` (Stripe **live** secret key, starts `sk_live_`)
- [ ] `STRIPE_WEBHOOK_SECRET` (`whsec_...` from the webhook endpoint below)
- [ ] `STRIPE_PRO_MONTHLY_PRICE_ID`
- [ ] `STRIPE_PRO_ANNUAL_PRICE_ID`
- [ ] `STRIPE_PLUS_MONTHLY_PRICE_ID`
- [ ] `STRIPE_PLUS_ANNUAL_PRICE_ID`

Optional fallback (still supported by code):
- [ ] `STRIPE_PRO_PRICE_ID` / `STRIPE_PLUS_PRICE_ID`

## 3. Stripe — webhook endpoint

- [ ] In Stripe Dashboard → Developers → Webhooks → Add endpoint:
      `https://noteschatai.com/api/billing/webhook`
- [ ] Subscribe to events: `checkout.session.completed`,
      `customer.subscription.updated`, `customer.subscription.deleted`,
      `invoice.payment_failed`
- [ ] Copy the **Signing secret** into `STRIPE_WEBHOOK_SECRET` env var

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

- [ ] Ensure `billing_period` column exists on `users`:
      `ALTER TABLE users ADD COLUMN billing_period TEXT DEFAULT 'monthly';`
      (or run the drizzle migration). Store whether a subscription is monthly/annual.

## 8. CSP — must be deployed to main domain (pending)

The code fix is in `src/middleware.ts` (whitelists `static.cloudflareinsights.com`
and the AdSense domain set). It must be deployed to `noteschatai.com` via the
same channel as Worker `ea38835f`. Until then, the **live site still blocks**
Cloudflare Web Analytics + AdSense quality calls (2 console errors on every page).

- [ ] Deploy the CSP fix to the main domain
- [ ] Verify zero CSP console errors on `/pricing`

---

## Ownership / accountability
| Item                                  | Owner | Blocked by        |
|---------------------------------------|-------|-------------------|
| 4 Stripe prices + bank + live mode    | Manav | Stripe dashboard  |
| Env vars + webhook                    | Agent | Secrets           |
| AdSense approval                      | Manav | Google review     |
| CSP deploy to main domain             | Agent | Deploy channel    |
| billing_period migration              | Agent | —                 |
