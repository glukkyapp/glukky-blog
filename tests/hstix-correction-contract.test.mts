import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";

const [routes, storage, home, hstix, schema, migrations, postMealCard, en, zhHant, yue] = await Promise.all([
  readFile("server/routes.ts", "utf8"),
  readFile("server/storage.ts", "utf8"),
  readFile("client/src/pages/home.tsx", "utf8"),
  readFile("client/src/pages/hstix.tsx", "utf8"),
  readFile("shared/schema.ts", "utf8"),
  readFile("server/startup-migrations.ts", "utf8"),
  readFile("client/src/components/PostMealCard.tsx", "utf8"),
  readFile("client/src/locales/en.json", "utf8"),
  readFile("client/src/locales/zh-Hant.json", "utf8"),
  readFile("client/src/locales/yue.json", "utf8"),
]);

assert.match(routes, /latestCorrectableReading:[\s\S]*:\s*null/, "the Home API has an explicit default state");
assert.match(routes, /correctionExpiresAt:\s*hstixCorrectionExpiresAt/, "the server issues correction expiry timestamps");
assert.match(routes, /app\.patch\("\/api\/hstix\/readings\/:id"/, "HStix corrections use the canonical record endpoint");
assert.match(routes, /code:\s*"HSTIX_CORRECTION_EXPIRED"/, "expired corrections have a stable API code");

const updateMethod = storage.slice(
  storage.indexOf("async updateHstixReadingWithinCorrectionWindow"),
  storage.indexOf("async getCarbSubtypePreferences"),
);
assert.match(updateMethod, /eq\(hstixReadings\.id, id\)/, "correction scopes the update to one record");
assert.match(updateMethod, /eq\(hstixReadings\.userId, userId\)/, "correction scopes the update to its owner");
assert.match(updateMethod, /gt\(hstixReadings\.recordedAt, cutoff\)/, "the exact expiry boundary is rejected in SQL");
assert.match(updateMethod, /\.set\(\{ glucoseMmol: data\.glucoseMmol, note: data\.note \}\)/, "only editable fields change");
assert.doesNotMatch(updateMethod, /recordedAt:/, "correction preserves the original timestamp");

assert.match(home, /correctionExpiresAt/, "Home schedules state from a server expiry");
assert.match(home, /hstix_home_change/, "Home exposes the five-minute Change action");
assert.match(home, /setLocation\(`\/hstix/, "Home sends the correction session to the canonical HStix screen");
assert.match(hstix, /correctionExpiresAt/, "the HStix screen receives server-issued correction expiry");
assert.match(hstix, /window\.setTimeout\(expire/, "the HStix screen closes an open correction at the server deadline");
assert.match(hstix, /setLocation\("\/hstix"\)/, "expiry returns to the safe standalone HStix state");
assert.match(hstix, /const showEntryForm = !correctionExpired \|\| !validReadingId/, "the standalone entry form returns immediately after expiry clears the correction URL");
assert.match(hstix, /\{showEntryForm && \(/, "the HStix wheel stays available after a correction expires");
assert.match(hstix, /onHstixCorrectionExpired/, "late PATCH expiry uses the same HStix recovery path");
assert.match(postMealCard, /hstixReadingId \? "PATCH" : "POST"/, "a correction updates rather than creates a record");
assert.match(postMealCard, /disabled=\{!canConfirmKeypad \|\| submitting\}/, "the correction confirm button blocks repeat submissions");
assert.match(postMealCard, /onHstixCorrectionExpired\?\.\(hstixReadingId\)/, "late correction responses identify their original record");
assert.match(postMealCard, /queryKey: \["\/api\/snap\/meal-log"\]/, "the Food Log-related cache refreshes after correction");
assert.match(schema, /hstix_readings_meal_unique_idx/, "the schema permits only one linked HStix reading per meal");
assert.match(migrations, /hstix_readings\.one_canonical_reading_per_meal/, "existing duplicate linked readings are deduplicated before the unique index");
assert.match(migrations, /CREATE UNIQUE INDEX IF NOT EXISTS hstix_readings_meal_unique_idx/, "the database enforces the canonical meal-to-reading cardinality");

for (const locale of [en, zhHant, yue]) {
  assert.match(locale, /"hstix_correction_expired":\s*"[^"]+"/, "expired correction feedback is localized");
}

console.log("22 HStix correction API/UI contracts passed");