import { pool } from "./db";

/**
 * Idempotent DDL migrations that run at server startup.
 * Each statement must be safe to re-run (use IF NOT EXISTS / IF EXISTS guards).
 * Add new columns here when drizzle-kit push cannot be used interactively
 * (e.g. tables with existing unique constraints that trigger its prompt).
 */
const MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: "users.apple_refresh_token",
    sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_refresh_token text",
  },
];

export async function runStartupMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    for (const m of MIGRATIONS) {
      try {
        await client.query(m.sql);
        console.log(`[startup-migrations] applied: ${m.name}`);
      } catch (e: any) {
        // Log but never crash the server over a best-effort migration
        console.error(`[startup-migrations] failed: ${m.name} — ${e?.message ?? e}`);
      }
    }
  } finally {
    client.release();
  }
}
