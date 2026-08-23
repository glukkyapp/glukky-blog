import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";

const [routes, storage, home, postMealCard, en, zhHant, yue] = await Promise.all([
  readFile("server/routes.ts", "utf8"),
  readFile("server/storage.ts", "utf8"),
  readFile("client/src/pages/home.tsx", "utf8"),
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
assert.match(home, /setSheetHstixReading\(correctableHstixReading\)/, "Home snapshots the correction target when Change opens");
assert.match(home, /sheetHstixReading\?\.id === correctableHstixReading\.id/, "an open correction sheet closes rather than becoming a new reading at expiry");
assert.match(home, /initialValue=\{sheetHstixReading\?\.glucoseMmol \?\? null\}/, "the correction wheel is prefilled from the stable target");
assert.match(home, /hstix_home_change/, "Home exposes the five-minute Change action");
assert.match(home, /hstixExpiryHandledReadingId/, "Home deduplicates expiry outcomes for one correction session");
assert.match(home, /expiredReadingId !== sheetHstixReading\?\.id/, "late expiry responses cannot affect a different correction session");
assert.match(postMealCard, /hstixReadingId \? "PATCH" : "POST"/, "a correction updates rather than creates a record");
assert.match(postMealCard, /disabled=\{!canConfirmKeypad \|\| submitting\}/, "the correction confirm button blocks repeat submissions");
assert.match(postMealCard, /onHstixCorrectionExpired\?\.\(hstixReadingId\)/, "late correction responses identify their original record");
assert.match(postMealCard, /queryKey: \["\/api\/snap\/meal-log"\]/, "the Food Log-related cache refreshes after correction");

for (const locale of [en, zhHant, yue]) {
  assert.match(locale, /"hstix_correction_expired":\s*"[^"]+"/, "expired correction feedback is localized");
}

console.log("18 HStix correction API/UI contracts passed");