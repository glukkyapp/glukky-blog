import assert from "node:assert/strict";
import { pool } from "../server/db";
import { PIGGY_BANK_MODE_MIGRATION_SQL } from "../server/startup-migrations";

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(`CREATE TEMP TABLE user_profiles (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id varchar NOT NULL UNIQUE
  )`);
  await client.query("INSERT INTO user_profiles (user_id) VALUES ('pre-existing')");
  await client.query(PIGGY_BANK_MODE_MIGRATION_SQL);
  await client.query("INSERT INTO user_profiles (user_id) VALUES ('new-after-migration')");

  const { rows } = await client.query<{
    user_id: string;
    piggy_bank_mode: string | null;
    piggy_bank_photo_set_index: number;
    piggy_bank_mode_auto_assigned: boolean;
  }>(`SELECT user_id, piggy_bank_mode, piggy_bank_photo_set_index,
      piggy_bank_mode_auto_assigned
    FROM user_profiles ORDER BY id`);
  assert.deepEqual(rows, [
    {
      user_id: "pre-existing",
      piggy_bank_mode: "garden",
      piggy_bank_photo_set_index: 0,
      piggy_bank_mode_auto_assigned: false,
    },
    {
      user_id: "new-after-migration",
      piggy_bank_mode: null,
      piggy_bank_photo_set_index: 0,
      piggy_bank_mode_auto_assigned: false,
    },
  ]);
  await client.query("ROLLBACK");
} finally {
  client.release();
  await pool.end();
}

console.log("Piggy-bank mode migration old/new row semantics passed");