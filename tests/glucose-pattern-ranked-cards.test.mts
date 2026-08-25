/**
 * Focused Glucose Patterns ranking contracts.
 *
 * Run with: npx tsx tests/glucose-pattern-ranked-cards.test.mts
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  rankActualFoods,
  rankMeasuredFoods,
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

console.log("\nMeasured-card display rules");
const measuredFoods = [
  { foodKey: "rice", lift: 1.5 },
  { foodKey: "noodles", lift: 1.8 },
  { foodKey: "bread", lift: 1.8 },
  { foodKey: "oats", lift: 0.6 },
  { foodKey: "potato", lift: 0.4 },
];
check("Higher-impact measured cards are ordered by lift descending with stable food-key ties",
  rankMeasuredFoods(measuredFoods.slice(0, 3), "high").map(food => food.foodKey).join("|") === "bread|noodles|rice");
check("Lower-impact measured cards are ordered by lift ascending",
  rankMeasuredFoods(measuredFoods.slice(3), "low").map(food => food.foodKey).join("|") === "potato|oats");
check("Measured Higher and Lower card ordering keeps all cards rather than imposing a display cap",
  rankMeasuredFoods(Array.from({ length: 7 }, (_, index) => ({ foodKey: `food-${index}`, lift: index })), "high").length === 7);

console.log("\nAI sampling rules");
const sample = sampleFoods(Array.from({ length: 8 }, (_, index) => index));
check("AI sample never exceeds five foods", sample.length === 5);
check("AI sample returns only eligible foods", sample.every(item => item >= 0 && item < 8));
check("Small AI cohorts remain intact", sampleFoods(["a", "b", "c"]).length === 3);

console.log("\nPage and API contracts");
const page = readFileSync("client/src/pages/glucose-patterns.tsx", "utf8");
const nav = readFileSync("client/src/components/floating-nav-bar.tsx", "utf8");
const profile = readFileSync("client/src/pages/profile.tsx", "utf8");
const routes = readFileSync("server/routes.ts", "utf8");
const storage = readFileSync("server/storage.ts", "utf8");
const en = readFileSync("client/src/locales/en.json", "utf8");
const zhHant = readFileSync("client/src/locales/zh-Hant.json", "utf8");
const yue = readFileSync("client/src/locales/yue.json", "utf8");

check("The established ten-snap lock remains in place", page.includes("const LOCKED_THRESHOLD = 10") && page.includes("totalSnaps < LOCKED_THRESHOLD"));
check("The ten-snap lock also protects search and food-detail API data", routes.includes('if (totalSnaps < 10)') && routes.includes('return res.status(403)'));
check("AI assessment is the initial tab", page.includes('useState<"ai" | "actual">("ai")'));
check("Measured Higher and Lower cards are ordered by lift while Medium cards use display-only random sampling",
  page.includes("rankMeasuredFoods(measuredFoods, level)") &&
  page.includes('level === "medium"') &&
  page.includes("sampleFoods(measuredFoods)"));
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
check("Partner warning, observed-combination advice, and non-causation disclaimer are localized", [en, zhHant, yue].every(locale =>
  ["pattern_partner_dominant", "pattern_partner_comparison", "pattern_partner_disclaimer"].every(key => locale.includes(`"${key}"`)),
));
check("Measured-card messages do not interpolate a food name or foreground lift", page.includes("pattern_hstix_description_${impact}") && !page.includes('pattern_hstix_description", { food') && !page.includes('pattern_lift")'));
check("HStix foods below the evidence threshold have their own section", page.includes("hstixNeedsMoreReadings") && page.includes("glucose-needs-more-readings") && page.includes("pattern_needs_more_readings_count") && page.includes("remaining: Math.max(0, 25 - selectedNeedsMoreReading.totalMeals)"));
check("Needs-more foods use a dropdown while the top cards remain swipeable", page.includes("SelectTrigger") && page.includes("glucose-needs-more-readings-selected") && page.includes("onPointerDown") && page.includes("glucose-ranking-card-"));
check("HStix flow does not show personalised UI", page.includes("!hasMeasuredList && isPersonalised"));
check("Partner insights render only inside the measured HStix card branch", page.includes('mode === "actual" && "lift" in activeFood') && page.includes("glucose-partner-dominant") && page.includes("glucose-partner-comparison") && page.includes("glucose-partner-disclaimer"));
check("Navigation keeps exactly the five requested destinations", !nav.includes('key: "hstix"') && !nav.includes('key: "health_info"') && nav.includes('key: "home"') && nav.includes('key: "report"') && nav.includes('key: "snap"') && nav.includes('key: "glucose"') && nav.includes('key: "profile"') && !nav.includes("overflowX") && nav.includes("flex-1"));
check("Profile contains the three labeled personal shortcuts", profile.includes("profile-personal-shortcuts") && profile.includes('path: "/hstix"') && profile.includes('path: "/food-log"') && profile.includes('path: "/health-info"') && profile.includes("shortcut_glucose") && profile.includes("shortcut_food_log") && profile.includes("shortcut_health_info"));

console.log(`\n${passed} passed`);