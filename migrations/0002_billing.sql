-- Billing & Quota columns for NotesChatAI
-- Run with: wrangler d1 execute noteschatai-db --file=migrations/0002_billing.sql

-- Stripe customer & subscription tracking
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'active';
ALTER TABLE users ADD COLUMN billing_period TEXT DEFAULT 'monthly';

-- Daily usage counters (reset at UTC midnight)
ALTER TABLE users ADD COLUMN chats_used_today INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN audio_used_today INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN documents_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN last_usage_reset TEXT;

-- Index for efficient quota lookups
CREATE INDEX users_stripe_customer_idx ON users(stripe_customer_id);
