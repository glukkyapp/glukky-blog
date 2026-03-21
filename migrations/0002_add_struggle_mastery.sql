ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "mastered_struggles" text[];
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "tried_before_struggles" text[];
