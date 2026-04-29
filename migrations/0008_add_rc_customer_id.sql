-- Per-profile RevenueCat customerId, written by the bridge on every
-- /api/refresh-premium-status that includes a customerId in the body.
-- Used to share the daily snap quota across all Glukky accounts that
-- belong to the same App Store subscription (Task #522). Nullable
-- because web/dev users have no native bridge and fall back to the
-- userId-keyed counter.

ALTER TABLE "user_profiles"
  ADD COLUMN IF NOT EXISTS "rc_customer_id" text;
