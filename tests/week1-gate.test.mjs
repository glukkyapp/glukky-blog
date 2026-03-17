/**
 * Regression test: Week-1 Sunday 10pm report gate
 *
 * Guards against re-introduction of the bug where week-1 users on Sunday ≥ 10pm
 * saw "your report is being prepared" instead of the planning/review flow.
 *
 * Mirrors the gate logic in client/src/pages/weekly-planner.tsx:
 *   const isPastPlanWeek = !!planSundayStr && effectiveDateStr > planSundayStr;
 *   const isWeek1 = !isPastPlanWeek && (profile?.currentWeek === 1 || currentPlan?.weekNumber === 1);
 *   const isSundayNight = (effectiveDayJS === 0) && (effectiveHour >= 22);
 *   const canPlan = isSundayNight || isLatePlanning;
 *   if (isWeek1 && currentPlan && !canPlan) { return renderPendingView(); }  ← THE FIX
 *
 * Run with: node tests/week1-gate.test.mjs
 */

import { strict as assert } from "assert";

function computeGate({ planSundayStr, effectiveDateStr, dateOverride, timeOverride, hasCurrentPlan = true }) {
  const isPastPlanWeek = !!planSundayStr && effectiveDateStr > planSundayStr;
  const isWeek1 = !isPastPlanWeek;

  const effectiveHour = (timeOverride !== null && timeOverride !== undefined) ? timeOverride : new Date().getHours();
  const effectiveDayJS = dateOverride
    ? new Date(dateOverride + "T00:00:00").getDay()
    : new Date().getDay();

  const isSunday = effectiveDayJS === 0;
  const isAfter10pm = effectiveHour >= 22;
  const isSundayNight = isSunday && isAfter10pm;
  const isLatePlanning = isPastPlanWeek && !isSunday;
  const canPlan = isSundayNight || isLatePlanning;

  const showsPending = isWeek1 && hasCurrentPlan && !canPlan;

  return { isPastPlanWeek, isWeek1, canPlan, isSundayNight, showsPending };
}

let passed = 0;
let failed = 0;

function check(label, condition, message) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label} — ${message}`);
    failed++;
  }
}

console.log("Week-1 report gate regression tests\n");

console.log("Scenario A: Week-1 user on Sunday 22:00 — planning flow must appear");
const sundayNight = computeGate({
  planSundayStr: "2026-03-22",
  effectiveDateStr: "2026-03-22",
  dateOverride: "2026-03-22",
  timeOverride: 22,
});
check(
  "pending screen NOT shown on Sunday 22:00",
  !sundayNight.showsPending,
  "REGRESSION: isWeek1=" + sundayNight.isWeek1 + " canPlan=" + sundayNight.canPlan + " showsPending=" + sundayNight.showsPending
);
check("canPlan is true on Sunday 22:00", sundayNight.canPlan, "canPlan should be true");
check("isSundayNight is true", sundayNight.isSundayNight, "isSundayNight should be true");

console.log("\nScenario B: Week-1 user at exactly 21:59 Sunday — pending must still appear");
const sundayBeforeThreshold = computeGate({
  planSundayStr: "2026-03-22",
  effectiveDateStr: "2026-03-22",
  dateOverride: "2026-03-22",
  timeOverride: 21,
});
check(
  "pending screen IS shown at 21:59 Sunday",
  sundayBeforeThreshold.showsPending,
  "pending should show before 22:00"
);
check("canPlan is false at 21:59", !sundayBeforeThreshold.canPlan, "canPlan should be false");

console.log("\nScenario C: Week-1 user on Tuesday 15:00 — pending must appear");
const tuesdayAfternoon = computeGate({
  planSundayStr: "2026-03-22",
  effectiveDateStr: "2026-03-17",
  dateOverride: "2026-03-17",
  timeOverride: 15,
});
check(
  "pending screen IS shown on Tuesday 15:00",
  tuesdayAfternoon.showsPending,
  "REGRESSION: pending not shown on weekday"
);
check("isWeek1 is true on Tuesday mid-week", tuesdayAfternoon.isWeek1, "isWeek1 should be true");

console.log("\nScenario D: Week-1 user with no plan — pending must NOT show (no plan = onboarding)");
const noPlan = computeGate({
  planSundayStr: null,
  effectiveDateStr: "2026-03-17",
  dateOverride: "2026-03-17",
  timeOverride: 15,
  hasCurrentPlan: false,
});
check(
  "pending NOT shown when no currentPlan exists",
  !noPlan.showsPending,
  "pending requires currentPlan to be truthy"
);

console.log("\nScenario E: Late planning (Mon after Sunday, past plan week) — canPlan must be true");
const latePlanning = computeGate({
  planSundayStr: "2026-03-22",
  effectiveDateStr: "2026-03-23",
  dateOverride: "2026-03-23",
  timeOverride: 10,
});
check(
  "canPlan is true during late-planning (Mon after plan week)",
  latePlanning.canPlan,
  "isLatePlanning should be true"
);
check(
  "pending NOT shown during late-planning",
  !latePlanning.showsPending,
  "late-planning bypasses pending"
);

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
