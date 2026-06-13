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
