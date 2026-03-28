/**
 * One-time wipe script for yusycyn@gmail.com test account.
 *
 * EXECUTED: 2026-03-28 — all rows deleted for userId 352049ea-0f08-4ca5-a980-62bef203e2a3
 *   84 weekly_plan_days deleted
 *   84 daily_logs deleted
 *   12 weekly_plans deleted
 *    0 weekly_reports deleted
 *    0 monthly_reports deleted
 *    2 piggy_bank_events deleted
 *    1 user_profiles deleted
 *
 * The 805b2497 (test-week1-spec@glukky.test) account was NOT touched.
 *
 * Re-running this script is safe (idempotent) — it will simply delete 0 rows
 * if the account is already gone or has been recreated without data.
 *
 * Usage (from workspace root):
 *   node scripts/wipe-test-account.mjs
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;

const TARGET_USER_ID = "352049ea-0f08-4ca5-a980-62bef203e2a3";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function wipe() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rowCount: days } = await client.query(
      "DELETE FROM weekly_plan_days WHERE weekly_plan_id IN (SELECT id FROM weekly_plans WHERE user_id = $1)",
      [TARGET_USER_ID]
    );
    const { rowCount: logs } = await client.query(
      "DELETE FROM daily_logs WHERE user_id = $1",
      [TARGET_USER_ID]
    );
    const { rowCount: plans } = await client.query(
      "DELETE FROM weekly_plans WHERE user_id = $1",
      [TARGET_USER_ID]
    );
    const { rowCount: wReports } = await client.query(
      "DELETE FROM weekly_reports WHERE user_id = $1",
      [TARGET_USER_ID]
    );
    const { rowCount: mReports } = await client.query(
      "DELETE FROM monthly_reports WHERE user_id = $1",
      [TARGET_USER_ID]
    );
    const { rowCount: piggy } = await client.query(
      "DELETE FROM piggy_bank_events WHERE user_id = $1",
      [TARGET_USER_ID]
    );
    const { rowCount: profile } = await client.query(
      "DELETE FROM user_profiles WHERE user_id = $1",
      [TARGET_USER_ID]
    );

    await client.query("COMMIT");

    console.log("Wipe complete:");
    console.log(`  ${days}  weekly_plan_days`);
    console.log(`  ${logs}  daily_logs`);
    console.log(`  ${plans}  weekly_plans`);
    console.log(`  ${wReports}  weekly_reports`);
    console.log(`  ${mReports}  monthly_reports`);
    console.log(`  ${piggy}  piggy_bank_events`);
    console.log(`  ${profile}  user_profiles`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

wipe().catch(err => {
  console.error("Wipe failed:", err);
  process.exit(1);
});
