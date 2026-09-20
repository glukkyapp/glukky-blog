import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  fetchMealLog,
  mealLogQueryKey,
  mealLogUrl,
} from "../client/src/lib/meal-log-query";
import { getMonthlyReportFinalLabel } from "../server/two-month-report";

let passed = 0;
function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`  ✓ ${label}`);
  passed += 1;
}

console.log("Meal-log query isolation");
assert.notDeepEqual(
  mealLogQueryKey("2026-09", true),
  mealLogQueryKey("2026-09", false),
  "opted-in and ordinary responses must not share a cache key",
);
passed += 1;
check("Only opted-in URLs request final impact",
  mealLogUrl("2026-09", true).includes("includeFinalImpact=true")
  && !mealLogUrl("2026-09", false).includes("includeFinalImpact"));

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => new Response(JSON.stringify({
    month: "2026-09",
    items: [{ id: 1, glucoseImpact: "low" }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  await assert.rejects(
    fetchMealLog("2026-09", true),
    /missing its final impact assessment/,
    "opted-in responses must reject a missing final impact",
  );
  passed += 1;

  globalThis.fetch = async () => new Response(JSON.stringify({
    month: "2026-09",
    items: [{ id: 1, finalGlucoseImpact: "unexpected" }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  await assert.rejects(
    fetchMealLog("2026-09", true),
    /invalid final impact assessment/,
    "opted-in responses must reject an invalid final impact",
  );
  passed += 1;

  globalThis.fetch = async () => new Response(JSON.stringify({
    month: "2026-09",
    items: [{ id: 1, finalGlucoseImpact: null }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  const valid = await fetchMealLog("2026-09", true);
  check("An explicit unavailable assessment remains valid", valid.items[0].finalGlucoseImpact === null);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("\nAuthoritative impact precedence");
const baseMeal = {
  id: 1,
  localDate: "2026-09-19",
  mealType: "lunch",
  glucoseImpact: "medium",
};
check("Healthy exact low boundary remains low",
  getMonthlyReportFinalLabel({
    ...baseMeal,
    hstix: { glucoseMmol: 5.9, mealTimingConfidence: "on_time" },
  }, "healthy") === "low");
check("Healthy exact high boundary remains high",
  getMonthlyReportFinalLabel({
    ...baseMeal,
    hstix: { glucoseMmol: 7.8, mealTimingConfidence: "on_time" },
  }, "healthy") === "high");
check("T2DM exact low boundary remains low",
  getMonthlyReportFinalLabel({
    ...baseMeal,
    hstix: { glucoseMmol: 7.5, mealTimingConfidence: "on_time" },
  }, "t2dm") === "low");
check("T2DM exact high boundary remains high",
  getMonthlyReportFinalLabel({
    ...baseMeal,
    hstix: { glucoseMmol: 10, mealTimingConfidence: "on_time" },
  }, "t2dm") === "high");
check("A missing profile group safely uses healthy defaults",
  getMonthlyReportFinalLabel({
    ...baseMeal,
    hstix: { glucoseMmol: 7.8, mealTimingConfidence: "on_time" },
  }, null) === "high");
check("Personalized thresholds are used for on-time readings",
  getMonthlyReportFinalLabel({
    ...baseMeal,
    hstix: { glucoseMmol: 6.4, mealTimingConfidence: "on_time" },
  }, "healthy", { lowMedBoundary: 6.5, medHighBoundary: 7.4 }) === "low");
check("Delayed readings fall back to AI",
  getMonthlyReportFinalLabel({
    ...baseMeal,
    hstix: { glucoseMmol: 9, mealTimingConfidence: "delayed" },
  }, "healthy") === "medium");
check("Unrelated readings fall back to AI",
  getMonthlyReportFinalLabel({
    ...baseMeal,
    hstix: { glucoseMmol: 9, mealTimingConfidence: "unrelated" },
  }, "healthy") === "medium");
check("Non-finite readings fall back to AI",
  getMonthlyReportFinalLabel({
    ...baseMeal,
    hstix: { glucoseMmol: Number.NaN, mealTimingConfidence: "on_time" },
  }, "healthy") === "medium");

console.log("\nSource contracts");
const routes = readFileSync("server/routes.ts", "utf8");
const foodLog = readFileSync("client/src/pages/food-log.tsx", "utf8");
const reports = readFileSync("client/src/pages/food-reports.tsx", "utf8");
const report = readFileSync("client/src/pages/report.tsx", "utf8");
const onboarding = readFileSync("client/src/pages/onboarding.tsx", "utf8");

check("Profile and threshold reads are gated by the opt-in",
  routes.includes("includeFinalImpact ? storage.getProfile(userId)")
  && routes.includes("includeFinalImpact ? storage.getUserGlucoseThresholds(userId)"));
check("Ordinary meal-log payloads omit the final-impact field",
  routes.includes("...(includeFinalImpact ? { finalGlucoseImpact } : {})"));
check("Food Log removed its duplicate classifier and profile request",
  !foodLog.includes("classifyMmol")
  && !foodLog.includes("interface ProfileData")
  && !foodLog.includes('queryKey: ["/api/profile"]'));
check("Food Log preserves the raw glucose number display",
  foodLog.includes("item.postMealGlucoseMmol!.toFixed(1)")
  && foodLog.includes("food-log-post-meal-glucose"));
check("Food Log uses the strict opted-in fetch and exact cache key",
  foodLog.includes("fetchMealLog(month, true)")
  && foodLog.includes("mealLogQueryKey(month, true)")
  && foodLog.includes("item.id === i.id") === false
  && foodLog.includes("i.id === item.id"));
check("Daily uses yesterday for both explicit timeline bounds",
  report.includes("startDate={yesterday}")
  && report.includes("endDate={yesterday}")
  && report.includes("includeFinalImpact"));
check("Food Log and Daily timeline share strict response validation",
  foodLog.includes("fetchMealLog(month, true)")
  && reports.includes("fetchMealLog(month, includeFinalImpact)")
  && reports.includes("mealLogQueryKey(month, includeFinalImpact)"));
check("Both compile-time MealTimeline callers use the parameterized signature",
  (report.match(/<MealTimeline/g) ?? []).length === 1
  && (reports.match(/<MealTimeline/g) ?? []).length === 1
  && !reports.includes("<MealTimeline weekStart="));
check("Onboarding profile save invalidates final-impact meal history",
  onboarding.includes('invalidateQueries({ queryKey: ["/api/snap/meal-log"] })'));
check("Bimonthly and Glucose Patterns endpoints were not coupled to the opt-in",
  !routes.slice(routes.indexOf('app.get("/api/snap/two-month-summary"'), routes.indexOf('app.get("/api/snap/weekly-summary"')).includes("includeFinalImpact")
  && !routes.slice(routes.indexOf('app.get("/api/snap/glucose-patterns"')).includes("includeFinalImpact"));

console.log(`\n${passed} Task #981 meal-impact checks passed.`);