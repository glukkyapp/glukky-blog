ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "eat_out_extended_commitment" boolean NOT NULL DEFAULT false;
ALTER TABLE "weekly_plans" ADD COLUMN IF NOT EXISTS "plan_struggle_cycle" integer NOT NULL DEFAULT 1;

-- Backfill plan_struggle_cycle for existing rows using cycle_history boundaries.
-- Plans whose week_number exceeds the Cycle 1 end_week are Cycle 2 plans.
UPDATE weekly_plans wp
SET plan_struggle_cycle = 2
FROM cycle_history ch
WHERE ch.user_id = wp.user_id
  AND ch.cycle_number = 1
  AND ch.end_week IS NOT NULL
  AND wp.week_number > ch.end_week;

-- Plans whose week_number exceeds the Cycle 2 end_week are Cycle 3 plans.
UPDATE weekly_plans wp
SET plan_struggle_cycle = 3
FROM cycle_history ch
WHERE ch.user_id = wp.user_id
  AND ch.cycle_number = 2
  AND ch.end_week IS NOT NULL
  AND wp.week_number > ch.end_week;
