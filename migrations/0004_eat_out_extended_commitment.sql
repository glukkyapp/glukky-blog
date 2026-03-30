ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "eat_out_extended_commitment" boolean NOT NULL DEFAULT false;
ALTER TABLE "weekly_plans" ADD COLUMN IF NOT EXISTS "plan_struggle_cycle" integer NOT NULL DEFAULT 1;
