#!/usr/bin/env node
// One-off operational script.
// Resets is_premium=false for yellowwmeowwww@gmail.com — undoes the
// accidental upgrade caused by the pre-fix paywall bug (Task #435).
//
// Usage (run against the PRODUCTION database connection string):
//   PROD_DATABASE_URL='postgres://...' node scripts/reset-premium-yellowwmeowwww.mjs
//
// Prints the row's is_premium value before and after the update.
// Safe to delete this file once the cleanup has been confirmed.

import pg from "pg";

const url = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Set PROD_DATABASE_URL (or DATABASE_URL) to the production connection string.");
  process.exit(1);
}

const EMAIL = "yellowwmeowwww@gmail.com";
const pool = new pg.Pool({ connectionString: url });

async function main() {
  const before = await pool.query(
    `SELECT u.email, up.is_premium
     FROM user_profiles up
     JOIN users u ON u.id = up.user_id
     WHERE u.email = $1`,
    [EMAIL],
  );
  console.log("Before:", before.rows);

  if (before.rows.length === 0) {
    console.log("No matching profile. Nothing to do.");
    return;
  }

  const upd = await pool.query(
    `UPDATE user_profiles
     SET is_premium = false
     WHERE user_id IN (SELECT id FROM users WHERE email = $1)
       AND is_premium = true`,
    [EMAIL],
  );
  console.log("Rows updated:", upd.rowCount);

  const after = await pool.query(
    `SELECT u.email, up.is_premium
     FROM user_profiles up
     JOIN users u ON u.id = up.user_id
     WHERE u.email = $1`,
    [EMAIL],
  );
  console.log("After:", after.rows);
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
