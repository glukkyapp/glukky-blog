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
