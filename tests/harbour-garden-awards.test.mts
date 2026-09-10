import assert from "node:assert/strict";
import { and, eq, like, or } from "drizzle-orm";
import { db, pool } from "../server/db";
import { storage } from "../server/storage";
import { dailyTaskCompletions, piggyBankEvents, userProfiles, users } from "../shared/schema";
import { createPiggyBankAward } from "../server/achievements";

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
  await db.delete(dailyTaskCompletions).where(eq(dailyTaskCompletions.userId, userId));
  await db.delete(piggyBankEvents).where(and(
    eq(piggyBankEvents.userId, userId),
    or(
      like(piggyBankEvents.achievementType, `${prefix}%`),
      eq(piggyBankEvents.achievementType, "daily_win_2099-01-01"),
      eq(piggyBankEvents.achievementType, "daily_win_2099-01-02"),
    ),
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

  await reset(0);
  const dailyDate = "2099-01-01";
  const dailyAward = createPiggyBankAward("daily_win", dailyDate);
  const dailyRace = await Promise.all([
    storage.completeDailyTaskAndAward({
      userId, localDate: dailyDate, taskId: "post_meal_walk", award: dailyAward,
    }),
    storage.completeDailyTaskAndAward({
      userId, localDate: dailyDate, taskId: "vegetable_dish", award: dailyAward,
    }),
  ]);
  assert.deepEqual(dailyRace.map(result => result.awarded).sort(), [0, 1]);
  assert.equal(new Set(dailyRace.map(result => result.completion.taskId)).size, 1);
  assert.equal(await balance(), 1);
  assert.ok(await storage.getPiggyBankEvent(userId, "daily_win_2099-01-01"));

  await reset(60);
  const cappedDate = "2099-01-02";
  const capped = await storage.completeDailyTaskAndAward({
    userId,
    localDate: cappedDate,
    taskId: "regular_mealtime",
    award: createPiggyBankAward("daily_win", cappedDate),
  });
  assert.equal(capped.awarded, 0);
  assert.equal(capped.completion.taskId, "regular_mealtime");
  assert.equal(await storage.getPiggyBankEvent(userId, "daily_win_2099-01-02"), undefined);

  console.log("Harbour Garden atomic award safeguards passed");
} finally {
  await reset(0);
  await pool.end();
}