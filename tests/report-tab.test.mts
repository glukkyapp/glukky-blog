/**
 * Focused Report-tab contract tests.
 *
 * Run with: npx tsx tests/report-tab.test.mts
 */

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  getReportPath,
  getReportView,
  isReportLocation,
} from "../client/src/lib/report-navigation";

let passed = 0;

function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`  ✓ ${label}`);
  passed += 1;
}

console.log("Report route behavior");
check("Report defaults to Daily", getReportView("") === "daily");
check("Unknown Report query defaults to Daily", getReportView("view=other") === "daily");
check("Weekly query opens Weekly", getReportView("view=weekly") === "weekly");
check("Daily navigation uses the clean Report path", getReportPath("daily") === "/report");
check("Weekly navigation is directly addressable", getReportPath("weekly") === "/report?view=weekly");
check("Report route is active", isReportLocation("/report"));
check("Weekly Report query remains active", isReportLocation("/report?view=weekly"));
check("Legacy report route remains active", isReportLocation("/food-reports"));
check("Food history remains inside Report", isReportLocation("/food-log?from=report"));
check("Notification food history does not impersonate Report", !isReportLocation("/food-log?snap=42"));
check("Direct food history does not impersonate Report", !isReportLocation("/food-log"));
check("Unrelated tabs are not marked as Report", !isReportLocation("/snap"));

const nav = readFileSync("client/src/components/floating-nav-bar.tsx", "utf8");
const report = readFileSync("client/src/pages/report.tsx", "utf8");
const daily = readFileSync("client/src/components/DailyFoodSummaryBanner.tsx", "utf8");
const weekly = readFileSync("client/src/pages/food-reports.tsx", "utf8");
const foodLog = readFileSync("client/src/pages/food-log.tsx", "utf8");
const home = readFileSync("client/src/pages/home.tsx", "utf8");
const app = readFileSync("client/src/App.tsx", "utf8");

console.log("\nReport UI contracts");
check("Food nav item was replaced by Report", nav.includes('key: "report"') && !nav.includes('key: "food"'));
check("Report navigation always resets to Daily", nav.includes('setLocation(key === "report" ? "/report" : path)'));
check("Daily and Weekly panels are explicit", report.includes("report-panel-daily") && report.includes("report-panel-weekly"));
check("Period switch uses native button semantics", report.includes("aria-pressed={tab === key}") && !report.includes('role="tab"'));
check("Daily view uses a compact weekly preview", report.includes('variant="preview"'));
check("Weekly view uses the detailed report", report.includes('variant="reports"'));
check("Meal action enters food history from Report", report.includes('setLocation("/food-log?from=report")'));
check("Food history back action returns to Report", foodLog.includes('get("from") === "report"') && foodLog.includes('setLocation("/report")'));

console.log("\nEmpty-state and content preservation");
check("No-record message is preserved exactly", daily.includes('primary: "昨日未見飲食記錄。"'));
check("No-record guidance is preserved exactly", daily.includes('primarySuggestion: "定時進食有助穩定全日血糖。"'));
check("Meal action is guarded by recorded meals", daily.includes("snaps.length > 0 && onViewMeal"));
check("Timeline is guarded by recorded meals", daily.includes("snaps.length > 0 && ("));
check("Detailed Weekly retains the donut", weekly.includes('(variant === "home" || variant === "reports")'));
check("Detailed Weekly retains the meal grid", weekly.includes('variant === "reports" && data.dailyGrid'));
check("Detailed Weekly retains score breakdown and disclaimer", weekly.includes("div-weekly-score-breakdown") && weekly.includes("text-weekly-disclaimer"));
check("Home no longer duplicates Daily and Weekly reports", !home.includes("DailyFoodSummaryBanner") && !home.includes("<WeeklyCard"));

console.log("\nGlobal font-size shortcut");
check("Authenticated layouts mount the Aa shortcut", app.split("<MainFontToggle />").length - 1 === 2);
const fontToggle = readFileSync("client/src/components/main-font-toggle.tsx", "utf8");
check("Aa shortcut persists through the existing profile endpoint", fontToggle.includes('"/api/profile/font-size"'));
check("Failed Aa save always restores the prior visual size", fontToggle.includes("previousSize") && fontToggle.includes("applyFontSize(context.previousSize)"));

console.log(`\n${passed} passed`);