#!/usr/bin/env node
/**
 * One-shot wipe for glukkysugarapp@gmail.com on PRODUCTION (Task #489).
 *
 * Hard-deletes the users row and every dependent row (profile, plans,
 * plan days, daily logs, weekly/monthly reports, piggy bank events,
 * cycle history, sessions) so the next sign-up with the same email
 * starts fresh from onboarding with no premium and no plan history.
 *
 * Deletion order mirrors storage.deleteUserCompletely() in
 * server/storage.ts, which is the same path the server already uses
 * for /api/admin/wipe-user and /api/auth/delete-account.
 *
 * Usage (run against the PRODUCTION database connection string):
 *   PROD_DATABASE_URL='postgres://...' node scripts/wipe-glukkysugarapp.mjs
 *
 * Behaviour:
 *   - Refuses to run unless PROD_DATABASE_URL is set explicitly
 *     (so it can never accidentally wipe the dev DB via DATABASE_URL).
 *   - Inventories every public table that has a user_id column up
 *     front and logs the list, so we can confirm nothing was missed.
 *   - Aborts with exit code 2 if MORE THAN ONE user matches the email
 *     (defensive against typos / duplicate accounts).
 *   - No-op (exit 0) if ZERO users match — re-running on an already
 *     empty account is safe.
 *   - Wraps all deletes in a single transaction.
 *   - Logs per-table deletion counts.
 *   - After commit, re-queries every inventoried user_id table plus
 *     the users table for residue (expect 0 everywhere).
 */

import pkg from "pg";
const { Pool } = pkg;

const EMAIL = "glukkysugarapp@gmail.com";
const url = process.env.PROD_DATABASE_URL;

if (!url) {
  console.error("Refusing to run: PROD_DATABASE_URL is not set.");
  console.error("Re-invoke as: PROD_DATABASE_URL='postgres://...' node scripts/wipe-glukkysugarapp.mjs");
  process.exit(1);
}

const HANDLED_USER_ID_TABLES = new Set([
  "piggy_bank_events",
  "monthly_reports",
  "weekly_reports",
  "daily_logs",
  "cycle_history",
  "weekly_plan_days", // joined via weekly_plans.id, not user_id
  "weekly_plans",
  "user_profiles",
]);

const pool = new Pool({ connectionString: url });

async function main() {
  const client = await pool.connect();
  try {
    // 1. Inventory every public table that has a user_id column.
    //    weekly_plan_days does NOT have user_id (it joins via
    //    weekly_plan_id) so it won't appear in this list — that's
    //    expected; we handle it explicitly via the plan-id subselect.
    const inv = await client.query(`
      SELECT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'user_id'
      ORDER BY table_name
    `);
    const userIdTables = inv.rows.map((r) => r.table_name);
    console.log("Tables with a user_id column (production):");
    for (const t of userIdTables) console.log(`  - ${t}`);

    const missed = userIdTables.filter((t) => !HANDLED_USER_ID_TABLES.has(t));
    if (missed.length > 0) {
      console.error(
        "\nABORT: production has user_id tables this script does not know about:",
        missed,
      );
      console.error("Add them to the wipe order before re-running.");
      process.exit(3);
    }

    // 2. Look up matching user(s) by lower-cased email.
    const lookup = await client.query(
      "SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)",
      [EMAIL],
    );
    if (lookup.rows.length > 1) {
      console.error(
        `\nABORT: ${lookup.rows.length} rows in users match ${EMAIL}:`,
        lookup.rows,
      );
      process.exit(2);
    }
    if (lookup.rows.length === 0) {
      console.log(`\nNo user with email ${EMAIL}. Nothing to wipe (idempotent no-op).`);
      return;
    }
    const userId = lookup.rows[0].id;
    console.log(`\nTarget userId: ${userId}`);

    // 3. Wipe in dependency order, single transaction. Order mirrors
    //    server/storage.ts -> deleteUserCompletely().
    await client.query("BEGIN");
    const counts = {};

    const wipeBy = async (table, where, params) => {
      const r = await client.query(`DELETE FROM ${table} WHERE ${where}`, params);
      counts[table] = r.rowCount;
    };

    await wipeBy("piggy_bank_events", "user_id = $1", [userId]);
    await wipeBy("monthly_reports", "user_id = $1", [userId]);
    await wipeBy("weekly_reports", "user_id = $1", [userId]);
    await wipeBy("daily_logs", "user_id = $1", [userId]);
    await wipeBy("cycle_history", "user_id = $1", [userId]);
    await wipeBy(
      "weekly_plan_days",
      "weekly_plan_id IN (SELECT id FROM weekly_plans WHERE user_id = $1)",
      [userId],
    );
    await wipeBy("weekly_plans", "user_id = $1", [userId]);
    await wipeBy("user_profiles", "user_id = $1", [userId]);
    // sessions stores the user id inside the JSONB sess blob; string-match
    // is the same approach used by storage.deleteUserCompletely.
    await wipeBy("sessions", "sess::text LIKE $1", [`%${userId}%`]);
    await wipeBy("users", "id = $1", [userId]);

    await client.query("COMMIT");

    console.log("\nWipe complete — per-table deletion counts:");
    for (const [t, n] of Object.entries(counts)) {
      console.log(`  ${String(n).padStart(4)}  ${t}`);
    }

    // 4. Verification — re-query every inventoried user_id table for
    //    residue, plus the users table by email. Expect 0 everywhere.
    console.log("\nResidue check (expect 0 everywhere):");
    for (const t of userIdTables) {
      const r = await client.query(
        `SELECT COUNT(*)::int AS n FROM ${t} WHERE user_id = $1`,
        [userId],
      );
      console.log(`  ${String(r.rows[0].n).padStart(4)}  ${t}`);
    }
    const planDayCheck = await client.query(
      `SELECT COUNT(*)::int AS n FROM weekly_plan_days
       WHERE weekly_plan_id IN (SELECT id FROM weekly_plans WHERE user_id = $1)`,
      [userId],
    );
    console.log(`  ${String(planDayCheck.rows[0].n).padStart(4)}  weekly_plan_days (via plan ids)`);
    const userCheck = await client.query(
      "SELECT COUNT(*)::int AS n FROM users WHERE LOWER(email) = LOWER($1)",
      [EMAIL],
    );
    console.log(`  ${String(userCheck.rows[0].n).padStart(4)}  users (by email)`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
