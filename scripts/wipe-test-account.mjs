#!/usr/bin/env node
/**
 * Reset the app data for the dedicated test account while retaining its auth
 * user. The table inventory targets current runtime data by user_id and does
 * not contain planner-era table handling.
 *
 * Usage: DATABASE_URL='postgres://...' node scripts/wipe-test-account.mjs
 */

import pkg from "pg";
const { Pool } = pkg;

const TARGET_USER_ID = "352049ea-0f08-4ca5-a980-62bef203e2a3";

if (!process.env.DATABASE_URL) {
  console.error("Refusing to run: DATABASE_URL is not set.");
  process.exit(1);
}

const quoteIdent = (identifier) => `"${identifier.replaceAll('"', '""')}"`;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function wipe() {
  const client = await pool.connect();
  try {
    const inventory = await client.query(`
      SELECT DISTINCT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'user_id'
      ORDER BY table_name
    `);
    await client.query("BEGIN");
    const counts = {};
    for (const { table_name: table } of inventory.rows) {
      const result = await client.query(
        `DELETE FROM ${quoteIdent(table)} WHERE user_id = $1`,
        [TARGET_USER_ID],
      );
      counts[table] = result.rowCount;
    }
    await client.query("COMMIT");

    console.log(`Test-account data reset for ${TARGET_USER_ID}:`);
    for (const [table, count] of Object.entries(counts)) {
      console.log(`  ${String(count).padStart(4)}  ${table}`);
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

wipe().catch((error) => {
  console.error("Wipe failed:", error);
  process.exit(1);
});