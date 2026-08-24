/**
 * Focused Glucose Patterns ranking contracts.
 *
 * Run with: npx tsx tests/glucose-pattern-ranked-cards.test.mts
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  rankActualFoods,
  sampleFoods,
  IMPACT_LEVELS,
} from "../client/src/lib/glucose-pattern-ranking";

let passed = 0;
function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`  ✓ ${label}`);
  passed += 1;
}

const foods = [
  { foodName: "Low later", avgPostMealMmol: 5.8, readingCount: 1 },
  { foodName: "Low tie, more readings", avgPostMealMmol: 5.8, readingCount: 3 },
  { foodName: "Low first", avgPostMealMmol: 5.1, readingCount: 1 },
  { foodName: "High first", avgPostMealMmol: 10.2, readingCount: 1 },
  { foodName: "High tie, more readings", avgPostMealMmol: 9.7, readingCount: 4 },
  { foodName: "High tie, fewer readings", avgPostMealMmol: 9.7, readingCount: 1 },
];

console.log("Actual-record ranking rules");
const low = rankActualFoods(foods.slice(0, 3), "low");
check("Low impact ranks lowest average first", low.map(food => food.foodName).join("|") === "Low first|Low tie, more readings|Low later");
const high = rankActualFoods(foods.slice(3), "high");
check("High impact ranks highest average first", high.map(food => food.foodName).join("|") === "High first|High tie, more readings|High tie, fewer readings");
check("All impact tabs are Low, Medium, High", IMPACT_LEVELS.join("|") === "low|medium|high");
check("Rankings are capped at five cards", rankActualFoods(Array.from({ length: 7 }, (_, index) => ({ avgPostMealMmol: index, readingCount: 1 })), "low").length === 5);

console.log("\nAI sampling rules");
const sample = sampleFoods(Array.from({ length: 8 }, (_, index) => index));
check("AI sample never exceeds five foods", sample.length === 5);
check("AI sample returns only eligible foods", sample.every(item => item >= 0 && item < 8));
check("Small AI cohorts remain intact", sampleFoods(["a", "b", "c"]).length === 3);

console.log("\nPage and API contracts");
const page = readFileSync("client/src/pages/glucose-patterns.tsx", "utf8");
const routes = readFileSync("server/routes.ts", "utf8");
const storage = readFileSync("server/storage.ts", "utf8");
const en = readFileSync("client/src/locales/en.json", "utf8");
const zhHant = readFileSync("client/src/locales/zh-Hant.json", "utf8");
const yue = readFileSync("client/src/locales/yue.json", "utf8");

check("The established ten-snap lock remains in place", page.includes("const LOCKED_THRESHOLD = 10") && page.includes("totalSnaps < LOCKED_THRESHOLD"));
check("The ten-snap lock also protects search and food-detail API data", routes.includes('if (totalSnaps < 10)') && routes.includes('return res.status(403)'));
check("AI assessment is the initial tab", page.includes('useState<"ai" | "actual">("ai")'));
check("Measured cards keep their API grouping order instead of ranking by lift", !page.includes("rankMeasuredFoods"));
check("Measured cards do not show ordinal ranks", page.includes('mode === "actual" && !hasMeasuredList') && !page.includes('mode === "actual" && <p'));
check("Cards support pointer swipes", page.includes("onPointerDown") && page.includes("onPointerUp") && page.includes("SWIPE_MIN_PX"));
check("Search uses a user-scoped live query", page.includes("?query=${encodeURIComponent(trimmedSearch)}") && routes.includes("storage.searchGlucosePatternFoods(userId"));
check("Food detail endpoint returns dated reading details", routes.includes("storage.getGlucosePatternFoodDetail(userId") && storage.includes("post_meal_recorded_at") && storage.includes("recordedAt"));
check("Unassessed food details never fabricate an impact level", page.includes("pattern_impact_unassessed") && !page.includes('impact={detailData.detail.impactLevel ?? "medium"}'));
check("Actual food categories use the existing classifier", routes.includes("classifyPostMealMmol(entry.avgPostMealMmol"));
check("Real food averages aggregate every recorded reading", storage.includes("GROUP BY ms.food_name") && !storage.includes("top_portions"));
check("AI source keeps its existing thirty-day window", storage.includes("ms.snap_time >= NOW() - INTERVAL '30 days'"));
check("All supported locales include the new tab, search, and five rank labels", [en, zhHant, yue].every(locale =>
  locale.includes('"pattern_mode_ai"') &&
  locale.includes('"pattern_search_label"') &&
  [1, 2, 3, 4, 5].every(rank => locale.includes(`"pattern_rank_${rank}"`)),
));
check("Measured impact terminology and reading-progress copy are localized", [en, zhHant, yue].every(locale =>
  ["pattern_measured_impact_high", "pattern_measured_impact_medium", "pattern_measured_impact_low", "pattern_needs_more_readings_heading", "pattern_needs_more_readings_count"].every(key => locale.includes(`"${key}"`)),
));
check("Measured-card messages do not interpolate a food name or foreground lift", page.includes("pattern_hstix_description_${impact}") && !page.includes('pattern_hstix_description", { food') && !page.includes('pattern_lift")'));
check("HStix foods below the evidence threshold have their own section", page.includes("hstixNeedsMoreReadings") && page.includes("glucose-needs-more-readings") && page.includes("remaining: Math.max(0, 25 - food.totalMeals)"));
check("HStix flow does not show personalised UI", page.includes("!hasMeasuredList && isPersonalised"));

console.log(`\n${passed} passed`);