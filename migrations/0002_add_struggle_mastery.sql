ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "mastered_struggles" text[] NOT NULL DEFAULT '{}';
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "tried_before_struggles" text[] NOT NULL DEFAULT '{}';
