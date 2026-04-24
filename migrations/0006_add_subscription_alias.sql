CREATE TABLE IF NOT EXISTS "subscription_alias" (
  "anonymous_app_user_id" varchar PRIMARY KEY NOT NULL,
  "replit_user_id" varchar NOT NULL,
  "verified" boolean NOT NULL DEFAULT false,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscription_alias_replit_user_idx"
  ON "subscription_alias" USING btree ("replit_user_id");

-- Defensive: if an earlier `db:push` created the table without the
-- `verified` column, add it idempotently. New deployments hit the
-- CREATE TABLE above and skip this no-op.
ALTER TABLE "subscription_alias"
  ADD COLUMN IF NOT EXISTS "verified" boolean NOT NULL DEFAULT false;
