-- Per-user OneSignal alias and pre-scheduling dedup table.
-- See task #500: ownership of the trigger time moves from the
-- always-awake assumption to OneSignal's queue. The unique index
-- on (user_id, notification_type, local_trigger_date) is the
-- on-disk guarantee that the hourly scheduler never
-- double-schedules the same trigger across restarts.

ALTER TABLE "user_profiles"
  ADD COLUMN IF NOT EXISTS "onesignal_external_id" text;

CREATE TABLE IF NOT EXISTS "scheduled_notifications" (
  "id" serial PRIMARY KEY,
  "user_id" varchar NOT NULL,
  "notification_type" varchar NOT NULL,
  "local_trigger_date" varchar NOT NULL,
  "send_at_utc" timestamp NOT NULL,
  "onesignal_notification_id" varchar,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "scheduled_notifications_user_type_date_uniq"
  ON "scheduled_notifications" USING btree (
    "user_id", "notification_type", "local_trigger_date"
  );
