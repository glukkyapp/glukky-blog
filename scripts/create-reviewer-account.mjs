/**
 * Idempotent script to pre-create the App Store / Google Play reviewer
 * account in the production database.
 *
 * Reviewer credentials:
 *   email:    glukkyreviewer@glukky.app
 *   password: ReviewGlukky2026
 *
 * The email is whitelisted in server/comp-emails.ts so the comp-premium
 * hook flips isPremium = true on first profile load. This script only
 * inserts the user row; the profile row is created by the app on first
 * login, so the reviewer goes through the normal onboarding flow.
 *
 * Re-running is a no-op if the user already exists.
 *
 * Usage (from workspace root, against the production DB):
 *   DATABASE_URL=<prod connection string> node scripts/create-reviewer-account.mjs
 */

import pkg from "pg";
import bcrypt from "bcrypt";

const { Pool } = pkg;

const REVIEWER_EMAIL = "glukkyreviewer@glukky.app";
const REVIEWER_PASSWORD = "ReviewGlukky2026";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const existing = await client.query(
      "SELECT id, email FROM users WHERE email = $1",
      [REVIEWER_EMAIL]
    );

    if (existing.rowCount > 0) {
      console.log(`Reviewer account already exists (id=${existing.rows[0].id}). No-op.`);
      return;
    }

    const hashed = await bcrypt.hash(REVIEWER_PASSWORD, 10);
    const inserted = await client.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id",
      [REVIEWER_EMAIL, hashed]
    );

    console.log(`Reviewer account created: id=${inserted.rows[0].id}, email=${REVIEWER_EMAIL}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error("Failed to create reviewer account:", err);
  process.exit(1);
});
