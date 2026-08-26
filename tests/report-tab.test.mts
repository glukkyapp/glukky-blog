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
const homeSource = readFileSync("client/src/pages/home.tsx", "utf8");
const app = readFileSync("client/src/App.tsx", "utf8");

console.log("\nReport UI contracts");
check("Food nav item was replaced by Report", nav.includes('key: "report"') && !nav.includes('key: "food"'));
check("Report navigation always resets to Daily", nav.includes('setLocation(key === "report" ? "/report" : path)'));
check("Daily and Weekly panels are explicit", report.includes("report-panel-daily") && report.includes("report-panel-weekly"));
check("Period switch uses native button semantics", report.includes("aria-pressed={tab === key}") && !report.includes('role="tab"'));
check("Daily view does not duplicate the Weekly report", !report.includes('variant="preview"') && !report.includes("button-open-weekly-report"));
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
check("Home no longer duplicates Daily and Weekly reports", !homeSource.includes("DailyFoodSummaryBanner") && !homeSource.includes("<WeeklyCard"));

console.log("\nGlobal font-size shortcut");
check("Authenticated layout mounts the Aa shortcut", app.includes("<MainFontToggle />"));
const fontToggle = readFileSync("client/src/components/main-font-toggle.tsx", "utf8");
const styles = readFileSync("client/src/index.css", "utf8");
check("Aa shortcut persists through the existing profile endpoint", fontToggle.includes('"/api/profile/font-size"'));
check("Failed Aa save always restores the prior visual size", fontToggle.includes("previousSize") && fontToggle.includes("applyFontSize(context.previousSize)"));
check("Font shortcut shows the current size without resizing its glyph", fontToggle.includes('current === "large" ? "AA" : "Aa"') && fontToggle.includes("font-toggle-glyph"));
check("Home does not retain the planner dinner check-in", !homeSource.includes("dinner_tonight_question"));
check("Fixed pixel text utilities scale in small-text mode", styles.includes("html.font-small .text-\\[29px\\]") && styles.includes("html.font-small .text-\\[18px\\]"));

console.log(`\n${passed} passed`);