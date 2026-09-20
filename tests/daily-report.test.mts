import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { buildDailyReport, getDailyReportVerdict } from "../server/daily-report";
import { getMonthlyReportFinalLabel } from "../server/two-month-report";
import {
  previousCalendarDateInTimezone,
  validateDailyReport,
} from "../client/src/lib/daily-report-query";

assert.equal(getDailyReportVerdict([]), "no_meals");
assert.equal(getDailyReportVerdict(["low", "low"]), "stable");
assert.equal(getDailyReportVerdict(["low", "medium"]), "medium");
assert.equal(getDailyReportVerdict(["low", "high"]), "high");
assert.equal(getDailyReportVerdict(["medium", "high"]), "high");
assert.equal(getDailyReportVerdict([null]), "unavailable", "unknown must never become stable");
assert.equal(getDailyReportVerdict(["low", null]), "unavailable", "all meals must be low for stable");
assert.equal(buildDailyReport("2026-09-19", []).verdict, "no_meals");
assert.equal(
  previousCalendarDateInTimezone(new Date("2026-03-09T04:30:00.000Z"), "America/New_York"),
  "2026-03-08",
  "spring-forward uses the prior local calendar day rather than subtracting 24 hours",
);
assert.equal(
  previousCalendarDateInTimezone(new Date("2025-12-31T16:30:00.000Z"), "Asia/Hong_Kong"),
  "2025-12-31",
  "year and month boundaries roll back correctly in the effective timezone",
);
const authoritativeHigh = getMonthlyReportFinalLabel({
  id: 2,
  localDate: "2026-09-19",
  mealType: "dinner",
  glucoseImpact: "low",
  hstix: { glucoseMmol: 8.2, mealTimingConfidence: "on_time" },
}, "healthy");
assert.equal(authoritativeHigh, "high", "an on-time reading overrides a disagreeing AI label");
assert.equal(getDailyReportVerdict([authoritativeHigh]), "high", "the verdict follows the authoritative result");

validateDailyReport({
  date: "2026-09-19",
  verdict: "high",
  meals: [{
    id: 1,
    snapTime: "2026-09-19T12:00:00.000Z",
    localDate: "2026-09-19",
    mealType: "lunch",
    foodName: "Lunch",
    finalGlucoseImpact: "high",
    postMealGlucoseMmol: 8.1,
  }],
});
assert.throws(
  () => validateDailyReport({
    date: "2026-09-19",
    verdict: "stable",
    meals: [{ id: 1, finalGlucoseImpact: "unexpected" }],
  }),
  /invalid final impact/,
);

const routes = readFileSync("server/routes.ts", "utf8");
const report = readFileSync("client/src/pages/report.tsx", "utf8");
const banner = readFileSync("client/src/components/DailyFoodSummaryBanner.tsx", "utf8");
assert.match(routes, /getMonthlyReportFinalLabel\(/, "daily uses the authoritative resolver");
assert.match(routes, /buildDailyReport\(date, meals\)/);
assert.match(report, /dailyReportQueryKey\(yesterday\)/);
assert.doesNotMatch(banner, /useQuery|glucoseImpact ===|isIrregular/, "banner has no independent query or classifier");
assert.match(report, /dailyVerdictTranslationKey\(dailyReport\.data\.verdict\)/);
assert.match(banner, /dailyVerdictTranslationKey\(report\.verdict\)/);

console.log("Daily report authority and unknown-impact checks passed.");