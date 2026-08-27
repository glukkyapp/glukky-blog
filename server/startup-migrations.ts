import { pool } from "./db";

/**
 * Idempotent DDL migrations that run at server startup.
 * Each statement must be safe to re-run (use IF NOT EXISTS / IF EXISTS guards).
 * Add new columns here when drizzle-kit push cannot be used interactively
 * (e.g. tables with existing unique constraints that trigger its prompt).
 */
const MIGRATIONS: Array<{ name: string; sql: string | null; fn?: (client: any) => Promise<void> }> = [
  {
    name: "users.apple_refresh_token",
    sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_refresh_token text",
  },
  {
    name: "profiles.backfill_glucose_group",
    sql: null,
    fn: async (client) => {
      const { deriveGlucoseGroupFromCondition } = await import("./glucose-thresholds");
      const { rows } = await client.query<{ user_id: string; health_condition: string }>(
        `SELECT user_id, health_condition FROM profiles WHERE glucose_group IS NULL AND health_condition IS NOT NULL`
      );
      let updated = 0;
      for (const row of rows) {
        const group = deriveGlucoseGroupFromCondition(row.health_condition);
        if (group) {
          await client.query(`UPDATE profiles SET glucose_group = $1 WHERE user_id = $2`, [group, row.user_id]);
          updated++;
        }
      }
      if (rows.length > 0) {
        console.log(`[startup-migrations] backfill_glucose_group: updated ${updated}/${rows.length} rows`);
      }
    },
  },
  {
    name: "food_advice_cache.clear_stale_v1",
    sql: "DELETE FROM food_advice_cache",
  },
  {
    name: "health_history.create_user_profile_health_history",
    sql: `CREATE TABLE IF NOT EXISTS user_profile_health_history (
      id SERIAL PRIMARY KEY,
      original_record_id INTEGER NOT NULL,
      user_id VARCHAR NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      change_reason TEXT,
      changed_by VARCHAR NOT NULL
    )`,
  },
  {
    name: "health_history.create_meal_snap_health_history",
    sql: `CREATE TABLE IF NOT EXISTS meal_snap_health_history (
      id SERIAL PRIMARY KEY,
      original_record_id INTEGER NOT NULL,
      user_id VARCHAR NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      change_reason TEXT,
      changed_by VARCHAR NOT NULL
    )`,
  },
  {
    name: "health_history.create_user_glucose_thresholds_history",
    sql: `CREATE TABLE IF NOT EXISTS user_glucose_thresholds_history (
      id SERIAL PRIMARY KEY,
      original_record_id INTEGER NOT NULL,
      user_id VARCHAR NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      change_reason TEXT,
      changed_by VARCHAR NOT NULL
    )`,
  },
  {
    name: "soft_delete.meal_snaps_is_deleted",
    sql: "ALTER TABLE meal_snaps ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE",
  },
  {
    name: "soft_delete.user_glucose_thresholds_is_deleted",
    sql: "ALTER TABLE user_glucose_thresholds ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE",
  },
  {
    name: "consent.create_user_consents",
    sql: `CREATE TABLE IF NOT EXISTS user_consents (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR NOT NULL,
      service_name TEXT NOT NULL,
      consented BOOLEAN NOT NULL,
      consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_address TEXT,
      app_version TEXT
    )`,
  },
  {
    name: "consent.create_user_consents_idx",
    sql: `CREATE INDEX IF NOT EXISTS user_consents_user_service_idx ON user_consents (user_id, service_name, consented_at DESC)`,
  },
  {
    name: "consent.backfill_onesignal_existing_users",
    sql: `INSERT INTO user_consents (user_id, service_name, consented, consented_at)
          SELECT up.user_id, 'onesignal', true, NOW()
          FROM user_profiles up
          WHERE (up.onesignal_player_id IS NOT NULL OR up.onesignal_external_id IS NOT NULL)
          AND NOT EXISTS (
            SELECT 1 FROM user_consents uc
            WHERE uc.user_id = up.user_id AND uc.service_name = 'onesignal'
          )`,
  },
  {
    name: "user_data.create_user_data_actions",
    sql: `CREATE TABLE IF NOT EXISTS user_data_actions (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR NOT NULL,
      action TEXT NOT NULL,
      performed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ip_address TEXT
    )`,
  },
  {
    name: "user_data.create_correction_requests",
    sql: `CREATE TABLE IF NOT EXISTS correction_requests (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR NOT NULL,
      record_type TEXT NOT NULL,
      approximate_date DATE,
      incorrect_value TEXT,
      correct_value TEXT,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMP
    )`,
  },
  {
    name: "user_data.create_deletion_requests",
    sql: `CREATE TABLE IF NOT EXISTS deletion_requests (
      user_id VARCHAR PRIMARY KEY,
      requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
      scheduled_deletion_at TIMESTAMP NOT NULL,
      cancelled_at TIMESTAMP
    )`,
  },
  {
    name: "users.deletion_pending",
    sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_pending BOOLEAN NOT NULL DEFAULT FALSE",
  },
  {
    name: "deletion_requests.immediate_delete",
    sql: "ALTER TABLE deletion_requests ADD COLUMN IF NOT EXISTS immediate_delete BOOLEAN NOT NULL DEFAULT FALSE",
  },
  {
    name: "apple_name_cache.create",
    sql: `CREATE TABLE IF NOT EXISTS apple_name_cache (
      subject TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  },
  {
    name: "apple_name_cache.seed_test_account",
    sql: `INSERT INTO apple_name_cache (subject, display_name, cached_at)
          VALUES ('001357.5cf21b20e64c4a2bb3791e0f7e7b5fdc.1556', 'cynthia', NOW())
          ON CONFLICT (subject) DO UPDATE SET display_name = 'cynthia', cached_at = NOW()`,
  },
  {
    name: "user_profiles.seed_test_account_name",
    sql: `UPDATE user_profiles SET name = 'test'
          WHERE user_id = 'eac37b12-0545-4a27-ad8e-0d81aa3e5224' AND (name IS NULL OR name = '')`,
  },
  {
    name: "user_profiles.fix_cynthia_account_name",
    sql: `UPDATE user_profiles SET name = 'cynthia'
          WHERE user_id = 'eac37b12-0545-4a27-ad8e-0d81aa3e5224'`,
  },
  {
    name: "user_profiles.diabetes_medication",
    sql: "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS diabetes_medication text",
  },
  {
    name: "meal_snaps.previous_meal_overlap",
    sql: "ALTER TABLE meal_snaps ADD COLUMN IF NOT EXISTS previous_meal_overlap boolean NOT NULL DEFAULT false",
  },
  {
    name: "meal_snaps.overlap_dismissed",
    sql: "ALTER TABLE meal_snaps ADD COLUMN IF NOT EXISTS overlap_dismissed boolean NOT NULL DEFAULT false",
  },
  {
    name: "meal_snaps.post_meal_walked",
    sql: "ALTER TABLE meal_snaps ADD COLUMN IF NOT EXISTS post_meal_walked boolean",
  },
  {
    name: "user_profiles.is_pilot_participant",
    sql: "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_pilot_participant boolean NOT NULL DEFAULT false",
  },
  {
    name: "user_profiles.pilot_enrolled_at",
    sql: "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS pilot_enrolled_at timestamptz NULL DEFAULT NULL",
  },
  {
    name: "user_profiles.diabetes_medication_check",
    sql: `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_diabetes_medication_check'
      ) THEN
        ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_diabetes_medication_check
          CHECK (diabetes_medication IS NULL OR diabetes_medication IN ('none','one_oral','multi_oral','insulin','prefer_not'));
      END IF;
    END $$`,
  },
  {
    name: "food_labels.food_items",
    sql: "ALTER TABLE food_labels ADD COLUMN IF NOT EXISTS food_items jsonb",
  },
  {
    name: "seed_data.meal_snaps_provenance",
    sql: `ALTER TABLE meal_snaps
          ADD COLUMN IF NOT EXISTS source varchar,
          ADD COLUMN IF NOT EXISTS seed_batch_id varchar`,
  },
  {
    name: "seed_data.hstix_readings_provenance",
    sql: `ALTER TABLE hstix_readings
          ADD COLUMN IF NOT EXISTS source varchar,
          ADD COLUMN IF NOT EXISTS seed_batch_id varchar`,
  },
  {
    name: "hstix_readings.one_canonical_reading_per_meal",
    sql: `DELETE FROM hstix_readings older
          USING hstix_readings newer
          WHERE older.meal_snap_id IS NOT NULL
            AND older.meal_snap_id = newer.meal_snap_id
            AND (
              older.recorded_at < newer.recorded_at
              OR (older.recorded_at = newer.recorded_at AND older.id < newer.id)
            );
          CREATE UNIQUE INDEX IF NOT EXISTS hstix_readings_meal_unique_idx
          ON hstix_readings (meal_snap_id)`,
  },
  {
    name: "snap_report.create_retained_meal_facts",
    sql: `CREATE TABLE IF NOT EXISTS snap_report_meal_facts (
      snap_id INTEGER PRIMARY KEY,
      user_id VARCHAR NOT NULL,
      local_date DATE NOT NULL,
      meal_type TEXT,
      final_impact TEXT
    );
    CREATE INDEX IF NOT EXISTS snap_report_meal_facts_user_date_idx
      ON snap_report_meal_facts (user_id, local_date);
    CREATE TABLE IF NOT EXISTS snap_report_user_metadata (
      user_id VARCHAR PRIMARY KEY,
      first_meal_local_date DATE NOT NULL
    )`,
  },
];

export async function runStartupMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    for (const m of MIGRATIONS) {
      try {
        if (m.fn) {
          await m.fn(client);
        } else if (m.sql) {
          await client.query(m.sql);
          console.log(`[startup-migrations] applied: ${m.name}`);
        }
      } catch (e: any) {
        // Log but never crash the server over a best-effort migration
        console.error(`[startup-migrations] failed: ${m.name} — ${e?.message ?? e}`);
      }
    }
  } finally {
    client.release();
  }
}
