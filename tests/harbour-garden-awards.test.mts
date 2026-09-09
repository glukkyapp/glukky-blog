import assert from "node:assert/strict";
import { and, eq, like } from "drizzle-orm";
import { db, pool } from "../server/db";
import { storage } from "../server/storage";
import { piggyBankEvents, userProfiles, users } from "../shared/schema";

const email = "test-harbour-garden@glukky.test";
const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
assert.ok(user, "Run tests/harbour-garden-api.spec.ts first to create the test user");

const userId = user.id;
const prefix = "atomic_harbour_";

async function balance() {
  const [profile] = await db.select({ coins: userProfiles.piggyBankCoins })
    .from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return profile?.coins;
}

async function reset(coins: number) {
  await db.delete(piggyBankEvents).where(and(
    eq(piggyBankEvents.userId, userId),
    like(piggyBankEvents.achievementType, `${prefix}%`),
  ));
  await storage.setPiggyBankCoinsForDevelopment(userId, coins);
}

try {
  await reset(58);
  const duplicate = await Promise.all([
    storage.awardPiggyBankCoin(userId, `${prefix}duplicate`, "test"),
    storage.awardPiggyBankCoin(userId, `${prefix}duplicate`, "test"),
  ]);
  assert.deepEqual(duplicate.sort(), [false, true]);
  assert.equal(await balance(), 59);

  await reset(59);
  const capacityRace = await Promise.all([
    storage.awardPiggyBankCoin(userId, `${prefix}a`, "test"),
    storage.awardPiggyBankCoin(userId, `${prefix}b`, "test"),
  ]);
  assert.deepEqual(capacityRace.sort(), [false, true]);
  assert.equal(await balance(), 60);

  const blocked = await storage.awardPiggyBankCoin(userId, `${prefix}at-cap`, "test");
  assert.equal(blocked, false);
  const atCapEvent = await storage.getPiggyBankEvent(userId, `${prefix}at-cap`);
  assert.equal(atCapEvent, undefined);

  console.log("Harbour Garden atomic award safeguards passed");
} finally {
  await reset(0);
  await pool.end();
}