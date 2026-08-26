#!/usr/bin/env node
/**
 * One-shot production account wipe for glukkysugarapp@gmail.com.
 *
 * This intentionally removes current account data only. It discovers every
 * public table with a user_id column rather than maintaining a planner-era
 * table list, then deletes sessions and the auth user in one transaction.
 *
 * Usage:
 *   PROD_DATABASE_URL='postgres://...' node scripts/wipe-glukkysugarapp.mjs
 */

import pkg from "pg";
const { Pool } = pkg;

const EMAIL = "glukkysugarapp@gmail.com";
const url = process.env.PROD_DATABASE_URL;

if (!url) {
  console.error("Refusing to run: PROD_DATABASE_URL is not set.");
  process.exit(1);
}

const quoteIdent = (identifier) => `"${identifier.replaceAll('"', '""')}"`;
const pool = new Pool({ connectionString: url });

async function main() {
  const client = await pool.connect();
  try {
    const lookup = await client.query(
      "SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)",
      [EMAIL],
    );
    if (lookup.rows.length > 1) {
      console.error(`ABORT: ${lookup.rows.length} users match ${EMAIL}.`, lookup.rows);
      process.exitCode = 2;
      return;
    }
    if (lookup.rows.length === 0) {
      console.log(`No user with email ${EMAIL}. Nothing to wipe.`);
      return;
    }

    const userId = lookup.rows[0].id;
    const inventory = await client.query(`
      SELECT DISTINCT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'user_id'
      ORDER BY table_name
    `);
    const userIdTables = inventory.rows.map((row) => row.table_name);

    await client.query("BEGIN");
    const counts = {};
    for (const table of userIdTables) {
      const result = await client.query(
        `DELETE FROM ${quoteIdent(table)} WHERE user_id = $1`,
        [userId],
      );
      counts[table] = result.rowCount;
    }
    const sessions = await client.query(
      "DELETE FROM sessions WHERE sess::text LIKE $1",
      [`%${userId}%`],
    );
    counts.sessions = sessions.rowCount;
    const users = await client.query("DELETE FROM users WHERE id = $1", [userId]);
    counts.users = users.rowCount;
    await client.query("COMMIT");

    console.log(`Wiped ${EMAIL} (${userId}):`);
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

main().catch((error) => {
  console.error("Wipe failed:", error);
  process.exit(1);
});