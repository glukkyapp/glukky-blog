CREATE TABLE IF NOT EXISTS "subscription_alias" (
  "anonymous_app_user_id" varchar PRIMARY KEY NOT NULL,
  "replit_user_id" varchar NOT NULL,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscription_alias_replit_user_idx"
  ON "subscription_alias" USING btree ("replit_user_id");
