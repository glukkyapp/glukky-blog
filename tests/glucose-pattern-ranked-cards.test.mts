/**
 * Focused Glucose Patterns ranking and live-contract coverage.
 *
 * Run with: npx tsx tests/glucose-pattern-ranked-cards.test.mts
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  rankMeasuredFoods,
  IMPACT_LEVELS,
} from "../client/src/lib/glucose-pattern-ranking";
import {
  buildRetainedFoodHistory,
  findGlucosePatternFoodForMode,
  findRetainedFoodHistoryEntry,
} from "../server/glucose-patterns";
import { selectGeneralTopFoods } from "../server/food-frequency";
import {
  deriveGiRank,
  getPublicGiState,
  isRecentNoMatch,
  validateGiMatches,
} from "../server/gi-resolution";
import {
  canResetGlucosePatternsSwipeTutorial,
  GLUCOSE_PATTERNS_SWIPE_TUTORIAL_TEST_EMAIL,
} from "../server/glucose-pattern-swipe-tutorial";

let passed = 0;
function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`  ✓ ${label}`);
  passed += 1;
}

function contrastRatio(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const channels = hex.match(/[A-Fa-f0-9]{2}/g)?.map(channel => {
      const value = Number.parseInt(channel, 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    if (!channels || channels.length !== 3) return 0;
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

console.log("Measured-card ranking rules");
check("All impact tabs are Low, Medium, High", IMPACT_LEVELS.join("|") === "low|medium|high");
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
check("The client ranking helper preserves the backend-selected result set",
  rankMeasuredFoods(Array.from({ length: 7 }, (_, index) => ({ foodKey: `food-${index}`, lift: index })), "high").length === 7);
const overlappingGeneral = [{ foodKey: "rice", foodNameEn: "Rice", foodNameZhHant: "白飯", foodNameYue: "白飯", mealCount: 12 }];
const overlappingHstix = [{ foodKey: "rice", foodNameEn: "Rice", foodNameZhHant: "白飯", foodNameYue: "白飯", lift: 1.4 }];
check("General detail selects frequency data when the same food also has HStix evidence",
  findGlucosePatternFoodForMode("general", "rice", overlappingGeneral, overlappingHstix)?.kind === "general");
check("HStix detail selects measured data for that same overlapping food",
  findGlucosePatternFoodForMode("hstix", "rice", overlappingGeneral, overlappingHstix)?.kind === "hstix");
const retainedHistory = buildRetainedFoodHistory([
  { foodName: "Chicken Breast", foodItems: null, isDeleted: false },
  { foodName: "chicken breast", foodItems: null, isDeleted: false },
  { foodName: "Deleted Chicken Breast", foodItems: null, isDeleted: true },
]);
check("Retained history indexes raw logged food names without pattern eligibility",
  retainedHistory.some(food => food.foodKey === "history:chicken breast" && food.mealCount === 2));
check("Deleted meals stay out of retained-history search",
  !retainedHistory.some(food => food.foodNameEn === "Deleted Chicken Breast"));
check("A retained-history selection resolves case-insensitively",
  findRetainedFoodHistoryEntry("CHICKEN BREAST", retainedHistory)?.mealCount === 2);

console.log("\nGeneral-card GI rules");
check("GI boundaries are deterministic at 55/56 and 69/70",
  [deriveGiRank(55), deriveGiRank(56), deriveGiRank(69), deriveGiRank(70)].join("|") ===
    "low|medium|medium|high");
const generalFoodsForGi = [
  { nameEn: "A", nameZhHant: "甲", nameYue: "甲", mealCount: 8, carbCategory: "rice" as const },
  { nameEn: "B", nameZhHant: "乙", nameYue: "乙", mealCount: 7, carbCategory: "bread" as const },
  { nameEn: "C", nameZhHant: "丙", nameYue: "丙", mealCount: 6, carbCategory: "other" as const },
  { nameEn: "D", nameZhHant: "丁", nameYue: "丁", mealCount: 5, carbCategory: "noodles" as const },
  { nameEn: "E", nameZhHant: "戊", nameYue: "戊", mealCount: 4, carbCategory: "potatoes" as const },
  { nameEn: "F", nameZhHant: "己", nameYue: "己", mealCount: 3, carbCategory: "rice" as const },
  { nameEn: "Single", nameZhHant: "單", nameYue: "單", mealCount: 1, carbCategory: null },
];
check("The shared General selector preserves frequency order and caps lookup at five",
  selectGeneralTopFoods(generalFoodsForGi).map(food => food.nameEn).join("|") === "A|B|C|D|E");
check("Resolved GI state exposes only a rank while missing data stays pending",
  JSON.stringify(getPublicGiState({ status: "resolved", giValue: 70, resolvedAt: new Date() })) ===
    '{"giRank":"high","giStatus":"resolved"}' &&
  JSON.stringify(getPublicGiState(undefined)) === '{"giRank":null,"giStatus":"pending"}');
check("A stored no-match suppresses hourly retries during its backoff",
  isRecentNoMatch({ status: "no_match", giValue: null, resolvedAt: new Date() }));
const validatedMatches = validateGiMatches([
  { inputIndex: 0, referenceId: "rice-white" },
  { inputIndex: 1, referenceId: "rice-white" },
], [
  { inputIndex: 0, candidates: [{ referenceId: "rice-white" }] },
  { inputIndex: 1, candidates: [{ referenceId: "bread-white" }] },
]);
check("A candidate ID valid for one input is rejected when returned for another input",
  validatedMatches.get(0) === "rice-white" && validatedMatches.has(1) === false);

console.log("\nPage and API contracts");
const page = readFileSync("client/src/pages/glucose-patterns.tsx", "utf8");
const nav = readFileSync("client/src/components/floating-nav-bar.tsx", "utf8");
const profile = readFileSync("client/src/pages/profile.tsx", "utf8");
const routes = readFileSync("server/routes.ts", "utf8");
const storage = readFileSync("server/storage.ts", "utf8");
const glucosePatterns = readFileSync("server/glucose-patterns.ts", "utf8");
const snap = readFileSync("client/src/pages/snap.tsx", "utf8");
const postMeal = readFileSync("client/src/components/PostMealCard.tsx", "utf8");
const recurringFoods = readFileSync("client/src/components/RecurringFoodInsights.tsx", "utf8");
const swipeableFoodCard = readFileSync("client/src/components/SwipeableFoodCard.tsx", "utf8");
const styles = readFileSync("client/src/index.css", "utf8");
const schema = readFileSync("shared/schema.ts", "utf8");
const startupMigrations = readFileSync("server/startup-migrations.ts", "utf8");
const giResolution = readFileSync("server/gi-resolution.ts", "utf8");
const report = readFileSync("client/src/pages/report.tsx", "utf8");
const twoMonth = readFileSync("server/two-month-report.ts", "utf8");
const en = readFileSync("client/src/locales/en.json", "utf8");
const zhHant = readFileSync("client/src/locales/zh-Hant.json", "utf8");
const yue = readFileSync("client/src/locales/yue.json", "utf8");
const generalStorageMethod = storage.slice(
  storage.indexOf("async getMealSnapsForGlucosePatterns"),
  storage.indexOf("async expireStalePostMealWindows"),
);

check("The established ten-snap lock remains in place",
  page.includes("const LOCKED_THRESHOLD = 10") && page.includes("totalSnaps < LOCKED_THRESHOLD"));
check("The ten-snap lock also protects search and food-detail API data",
  routes.includes('if (totalSnaps < 10)') && routes.includes("return res.status(403)"));
check("Measured Higher and Lower cards preserve lift ordering while Medium cards use display-only random sampling",
  page.includes("rankMeasuredFoods(foods, level)") &&
  page.includes('level === "medium"') &&
  page.includes("sampleFoods(foods)"));
check("An empty HStix response does not hide the General component-frequency list",
  page.includes("(data?.hstixList?.length ?? 0) > 0") &&
  page.includes("(data?.hstixNeedsMoreReadings?.length ?? 0) > 0") &&
  !page.includes("data?.hstixList !== undefined"));
check("General and HStix are explicit user-selected groups",
  page.includes('type PatternMode = "general" | "hstix"') &&
  page.includes('data-testid="glucose-mode-general"') &&
  page.includes('data-testid="glucose-mode-hstix"') &&
  page.includes('useState<PatternMode>("general")'));
check("Impact controls and needs-more readings are inside the HStix branch",
  page.includes("{isHstixMode ? (") &&
  page.includes("data-testid={`glucose-impact-${level}`}") &&
  page.includes("glucose-needs-more-readings"));
check("Measured cards show their selected ranking position while retaining the High/total result",
  page.includes("glucose-card-rank") &&
  page.includes("pattern_rank_${activeIndex + 1}") &&
  page.includes("pattern_hstix_result") &&
  page.includes("high: activeFood.highMeals") &&
  page.includes("total: activeFood.totalMeals"));
check("Medium cards suppress ordinal text without changing five-card sampling",
  page.includes('impact !== "medium"') &&
  page.includes("sampleFoods(foods)"));
check("The backend caps directional result groups at five after lift ordering",
  glucosePatterns.includes("MAX_DIRECTIONAL_HSTIX_FOOD_CARDS = 5") &&
  glucosePatterns.includes(".slice(0, MAX_DIRECTIONAL_HSTIX_FOOD_CARDS)"));
check("Cards support pointer swipes",
  swipeableFoodCard.includes("onPointerDown") &&
  swipeableFoodCard.includes("onPointerUp") &&
  swipeableFoodCard.includes("SWIPE_MIN_PX") &&
  swipeableFoodCard.includes("touch-pan-y"));
check("Search uses retained food history rather than only eligible pattern cards",
  page.includes("?mode=${mode}&query=${encodeURIComponent(trimmedSearch)}") &&
  routes.includes("storage.getMealSnapsForGlucosePatterns(userId)") &&
  routes.includes("buildRetainedFoodHistory(historyMeals)") &&
  glucosePatterns.includes("rawFoodName"));
check("Search and detail remain scoped to the selected General or HStix history",
  page.includes('queryKey: ["/api/snap/glucose-patterns", "search", mode, trimmedSearch]') &&
  page.includes('queryKey: ["/api/snap/glucose-patterns", "detail", mode, selectedFood]') &&
  page.includes("?mode=${mode}&food=${encodeURIComponent(selectedFood!)}") &&
  routes.includes('requestedMode === "hstix"') &&
  routes.includes("? await storage.getMealSnapsForHstixCards(userId)") &&
  routes.includes(": await storage.getMealSnapsForGlucosePatterns(userId)"));
check("A retained food without pattern evidence gets a truthful non-glucose detail",
  routes.includes('kind: "history"') &&
  page.includes('detailData.detail.kind === "history"') &&
  page.includes("pattern_history_no_glucose_data"));
check("Infrequent HStix history returns its real readings without becoming a ranked card",
  routes.includes('requestedMode === "hstix" && retainedEntry') &&
  routes.includes("const matchingReadings = hstixSnaps") &&
  routes.includes("avgPostMealMmol") &&
  routes.includes("classifyPostMealMmol(avgPostMealMmol, glucoseGroup)"));
check("Measured detail keeps dated readings while General detail is frequency-only",
  routes.includes('kind: "hstix"') &&
  routes.includes("recordedAt: snap.recordedAt.toISOString()") &&
  routes.includes('kind: "general"') &&
  page.includes('detailData.detail.kind === "general"'));
check("General storage reads active structured metadata without glucose aggregation",
  storage.includes("getMealSnapsForGlucosePatterns") &&
  storage.includes("foodName: mealSnaps.foodName") &&
  storage.includes("foodItems: mealSnaps.foodItems") &&
  storage.includes("eq(mealSnaps.isDeleted, false)") &&
  !generalStorageMethod.includes("hstixReadings") &&
  !storage.includes("GROUP BY ms.food_name") &&
  !storage.includes("getGlucosePatternFoodDetail"));
check("General output contains frequency identity and no glucose calculations",
  glucosePatterns.includes("buildGeneralGlucosePatternComponents") &&
  glucosePatterns.includes("mealCount") &&
  !routes.includes("classifyPostMealMmol(entry.avgPostMealMmol") &&
  !page.includes("(activeFood as GlucosePatternEntry).avgPostMealMmol"));
check("All supported locales include search and component type labels", [en, zhHant, yue].every(locale =>
  locale.includes('"pattern_search_label"') &&
  ["pattern_mode_general", "pattern_mode_hstix", "pattern_component_type_carb", "pattern_component_type_sweet_food", "pattern_component_type_sweet_drink", "pattern_frequency_count"]
    .every(key => locale.includes(`"${key}"`)),
));
check("General presents up to five foods in the shared one-card carousel followed by one category card",
  page.includes("<RecurringFoodInsights />") &&
  !report.includes("RecurringFoodInsights") &&
  recurringFoods.includes("data?.topFoods ?? []") &&
  routes.includes("selectGeneralTopFoods(summary.foods)") &&
  recurringFoods.includes("<SwipeableFoodCard") &&
  recurringFoods.includes("activeFood") &&
  recurringFoods.includes('data-testid="recurring-food-card"') &&
  recurringFoods.includes("data.sweetSubtypes.map") &&
  recurringFoods.includes("(data.carbCategories ?? []).map") &&
  recurringFoods.includes("categories[0].key") &&
  recurringFoods.includes("favourite_category_title") &&
  recurringFoods.includes("topFoods.length > 0") &&
  recurringFoods.includes("favouriteCategory &&") &&
  !page.includes("glucose-general-component-list") &&
  !recurringFoods.includes(".filter(category => category.mealCount"));
check("GI is server-resolved only for the shared General top-five selection",
  routes.includes("const topFoods = selectGeneralTopFoods(summary.foods)") &&
  routes.includes("getFoodGiEntries(keys)") &&
  routes.includes("getGiCandidatesForFood(food)") &&
  routes.includes("matchable = claimed.filter") &&
  !routes.includes("requestsByIndex") &&
  routes.includes("matchesByIndex") &&
  giResolution.includes("candidateIdsByIndex.get(inputIndex)?.has(referenceId)") &&
  giResolution.includes("GI_NO_MATCH_RETRY_MS"));
check("Each unresolved food requires an atomic expiring database claim before Claude",
  storage.includes("async claimFoodGiEntry") &&
  storage.includes("ON CONFLICT (normalized_food_name) DO UPDATE") &&
  storage.includes("RETURNING normalized_food_name") &&
  routes.includes("if (wonClaim) claimed.push({ ...request, claimToken })") &&
  routes.includes("const matchable = claimed.filter"));
check("Only the current claim owner can finalize a GI result",
  storage.includes("async completeFoodGiEntry") &&
  storage.includes("AND status = 'pending'") &&
  storage.includes("AND claim_token = ${entry.claimToken}") &&
  routes.includes("claimToken: request.claimToken!"));
check("Claude may only choose a supplied per-food reference ID and never returns GI or confidence",
  giResolution.includes("candidateIdsByIndex.get(inputIndex)?.has(referenceId)") &&
  routes.includes("Do not estimate or return a GI value, GI range, rank, confidence") &&
  !schema.slice(schema.indexOf("foodGiEntries"), schema.indexOf("export type FoodItemMetadata")).includes("confidence") &&
  !recurringFoods.toLocaleLowerCase().includes("confidence"));
check("The public General card payload and UI never expose numeric GI values",
  routes.includes("getPublicGiState(entriesByKey.get(key))") &&
  recurringFoods.includes('data-testid="general-food-gi-rank"') &&
  !recurringFoods.includes("giValue") &&
  !recurringFoods.includes("referenceId"));
check("GI resolution is hourly background work, not meal-log work",
  routes.includes("runGiResolutionJob().catch") &&
  routes.includes("}, 60 * 60 * 1000)") &&
  (routes.match(/runGiResolutionJob\(/g)?.length ?? 0) === 2);
check("GI labels and ranks are localized with the exact Traditional Chinese label",
  [en, zhHant, yue].every(locale =>
    ["gi_label", "gi_rank_low", "gi_rank_medium", "gi_rank_high", "gi_pending", "gi_unavailable"]
      .every(key => locale.includes(`"${key}"`))) &&
  zhHant.includes('"gi_label": "升糖指數"') &&
  recurringFoods.includes('t("glucose.gi_label")'));
check("Both General and HStix use the same swipeable-card implementation",
  recurringFoods.includes('from "@/components/SwipeableFoodCard"') &&
  page.includes('from "@/components/SwipeableFoodCard"') &&
  recurringFoods.includes("<SwipeableFoodCard") &&
  page.includes("<SwipeableFoodCard"));
check("Multi-card carousels expose a cue, next-card sliver, position, and 44px controls",
  swipeableFoodCard.includes('data-testid="pattern-swipe-cue"') &&
  swipeableFoodCard.includes('data-testid="pattern-next-card-sliver"') &&
  swipeableFoodCard.includes('data-testid="pattern-position"') &&
  swipeableFoodCard.includes('className="h-11 w-11 p-0"') &&
  swipeableFoodCard.includes("{isMultiCard && (") &&
  swipeableFoodCard.includes("{hasNextCard && ("));
check("Single-card viewports are not presented as keyboard or pointer controls",
  swipeableFoodCard.includes("tabIndex={isMultiCard ? 0 : undefined}") &&
  swipeableFoodCard.includes("onKeyDown={isMultiCard ? handleKeyDown : undefined}") &&
  swipeableFoodCard.includes("onPointerDown={isMultiCard ? handlePointerDown : undefined}") &&
  swipeableFoodCard.includes("onPointerUp={isMultiCard ? handlePointerUp : undefined}"));
check("Carousel navigation works with pointer gestures and keyboard arrows",
  swipeableFoodCard.includes('event.key === "ArrowLeft"') &&
  swipeableFoodCard.includes('event.key === "ArrowRight"') &&
  swipeableFoodCard.includes("tabIndex={isMultiCard ? 0 : undefined}") &&
  swipeableFoodCard.includes("distance <= -SWIPE_MIN_PX") &&
  swipeableFoodCard.includes("distance >= SWIPE_MIN_PX"));
check("The first eligible carousel tutorial is delayed, account-persistent, and reduced-motion safe",
  swipeableFoodCard.includes('SWIPE_TUTORIAL_QUERY_PATH = "/api/user/glucose-patterns/swipe-tutorial"') &&
  swipeableFoodCard.includes("SWIPE_TUTORIAL_DELAY_MS = 650") &&
  swipeableFoodCard.includes("useAuth()") &&
  swipeableFoodCard.includes("tutorialQueryKey") &&
  swipeableFoodCard.includes("apiRequest(\"POST\", SWIPE_TUTORIAL_SEEN_PATH") &&
  !swipeableFoodCard.includes("localStorage") &&
  swipeableFoodCard.includes('data-testid="pattern-swipe-tutorial"') &&
  styles.includes("@media (prefers-reduced-motion: reduce)") &&
  styles.includes("translateX(-30px)"));
check("Swipe tutorial persistence is stored on each user profile",
  schema.includes('glucosePatternsSwipeTutorialSeen: boolean("glucose_patterns_swipe_tutorial_seen").notNull().default(false)') &&
  startupMigrations.includes("ADD COLUMN IF NOT EXISTS glucose_patterns_swipe_tutorial_seen boolean NOT NULL DEFAULT false") &&
  routes.includes('app.get("/api/user/glucose-patterns/swipe-tutorial"') &&
  routes.includes('app.post("/api/user/glucose-patterns/swipe-tutorial/seen"') &&
  routes.includes("{ glucosePatternsSwipeTutorialSeen: true }"));
check("Only the exact development test account can reset its swipe tutorial",
  canResetGlucosePatternsSwipeTutorial(GLUCOSE_PATTERNS_SWIPE_TUTORIAL_TEST_EMAIL, "development") &&
  canResetGlucosePatternsSwipeTutorial(" GLUCOSETEST@GMAIL.COM ", "development") &&
  !canResetGlucosePatternsSwipeTutorial("someone-else@gmail.com", "development") &&
  !canResetGlucosePatternsSwipeTutorial(GLUCOSE_PATTERNS_SWIPE_TUTORIAL_TEST_EMAIL, "production") &&
  !canResetGlucosePatternsSwipeTutorial(GLUCOSE_PATTERNS_SWIPE_TUTORIAL_TEST_EMAIL, undefined) &&
  routes.includes('app.post("/api/dev/glucose-patterns/swipe-tutorial/reset"') &&
  routes.indexOf("canResetGlucosePatternsSwipeTutorial") < routes.indexOf("{ glucosePatternsSwipeTutorialSeen: false }"));
check("HStix cards use pale semantic surfaces, gentle borders, and soft shadows without a thick left stripe",
  page.includes('low: "border border-[#55B98A] bg-[#F2FBF6]"') &&
  page.includes('medium: "border border-[#D49A22] bg-[#FFFBEA]"') &&
  page.includes('high: "border border-[#E85A5A] bg-[#FFF4F3]"') &&
  styles.includes('.glucose-pattern-card[data-impact="low"]') &&
  styles.includes("0 10px 28px rgba(45, 122, 84, 0.10) !important") &&
  styles.includes('.glucose-pattern-card[data-impact="medium"]') &&
  styles.includes("0 10px 28px rgba(163, 112, 20, 0.10) !important") &&
  styles.includes('.glucose-pattern-card[data-impact="high"]') &&
  styles.includes("0 10px 28px rgba(181, 67, 67, 0.10) !important") &&
  page.includes("glucose-pattern-card is-active min-h-40 rounded-[32px]") &&
  swipeableFoodCard.includes("touch-pan-y overflow-hidden rounded-[32px]") &&
  !page.includes("border-l-4"));
check("General and HStix cards use the requested base and active elevations",
  recurringFoods.includes('className="glucose-pattern-card border') &&
  recurringFoods.includes('className="glucose-pattern-card is-active border') &&
  page.includes("glucose-pattern-card min-h-40") &&
  page.includes("glucose-pattern-card is-active min-h-40") &&
  styles.includes("0 4px 10px rgba(35, 54, 49, 0.07), 0 14px 28px rgba(35, 54, 49, 0.08)") &&
  styles.includes("0 6px 14px rgba(35, 54, 49, 0.10), 0 18px 36px rgba(35, 54, 49, 0.10)"));
check("HStix badge and supporting-text colours meet WCAG AA against every pale card surface",
  [
    ["#1F6B4B", "#DDF4E8"],
    ["#6B4A0F", "#FFF0C2"],
    ["#9D2F2F", "#FFE0DE"],
    ["#43594D", "#F2FBF6"],
    ["#43594D", "#FFFBEA"],
    ["#43594D", "#FFF4F3"],
  ].every(([foreground, background]) => contrastRatio(foreground, background) >= 4.5));
check("Food-frequency category labels cover sweet and carb categories in every locale", [en, zhHant, yue].every(locale =>
  ["sweet_drink", "sweet_food", "rice", "noodles", "bread", "potatoes", "other"]
    .every(key => locale.includes(`"${key}"`)),
));
check("Recurring-food titles and category-card copy are localized",
  en.includes('"title": "Your most frequently eaten blood sugar–raising foods"') &&
  zhHant.includes('"title": "你最常吃的升糖飲食"') &&
  yue.includes('"title": "你最常食嘅升糖飲食"') &&
  [en, zhHant, yue].every(locale => locale.includes('"favourite_category_title"')));
check("Personalised glucose copy avoids threshold and colour-band wording",
  en.includes('"personalised_popup_title": "Personalised glucose values ready"') &&
  zhHant.includes('"personalised_popup_title": "個人化血糖值已設定"') &&
  yue.includes('"personalised_popup_title": "個人化血糖值已設定"') &&
  !page.includes("personalised_disclaimer") &&
  ![en, zhHant, yue].some(locale => locale.includes('"personalised_disclaimer"')) &&
  !zhHant.includes("個人閾值") &&
  !yue.includes("個人閾值"));
check("HStix recorded-food and retained-history fallback copy are localized",
  en.includes('"pattern_mode_hstix": "HStix recorded food"') &&
  zhHant.includes('"pattern_mode_hstix": "已紀錄血糖的食物"') &&
  yue.includes('"pattern_mode_hstix": "已記錄血糖嘅食物"') &&
  [en, zhHant, yue].every(locale =>
    ["pattern_history_detail_description", "pattern_history_recorded_label", "pattern_history_no_glucose_data"]
      .every(key => locale.includes(`"${key}"`))));
check("Measured impact terminology and reading-progress copy are localized", [en, zhHant, yue].every(locale =>
  ["pattern_measured_impact_high", "pattern_measured_impact_medium", "pattern_measured_impact_low", "pattern_needs_more_readings_heading", "pattern_needs_more_readings_count"]
    .every(key => locale.includes(`"${key}"`)),
));
check("Swipe guidance, tutorial acknowledgement, and carousel labels are localized", [en, zhHant, yue].every(locale =>
  ["pattern_carousel_label", "pattern_swipe_cue", "pattern_swipe_tutorial", "pattern_swipe_tutorial_acknowledge"]
    .every(key => locale.includes(`"${key}"`)),
) && zhHant.includes('"pattern_swipe_cue": "向左滑查看下一款食物"'));
check("Partner warning, observed-combination advice, and non-causation disclaimer are localized", [en, zhHant, yue].every(locale =>
  ["pattern_partner_dominant", "pattern_partner_comparison", "pattern_partner_disclaimer"]
    .every(key => locale.includes(`"${key}"`)),
));
check("Measured-card messages do not interpolate a food name or foreground lift",
  page.includes("pattern_hstix_description_${impact}") &&
  !page.includes('pattern_hstix_description", { food') &&
  !page.includes('pattern_lift")'));
check("HStix foods below the evidence threshold have their own section",
  page.includes("hstixNeedsMoreReadings") &&
  page.includes("glucose-needs-more-readings") &&
  page.includes("pattern_needs_more_readings_count") &&
  page.includes("remaining: Math.max(0, 25 - selectedNeedsMoreReading.totalMeals)"));
check("Needs-more foods use a dropdown while the top cards remain swipeable",
  page.includes("SelectTrigger") &&
  page.includes("glucose-needs-more-readings-selected") &&
  page.includes("<SwipeableFoodCard") &&
  page.includes("glucose-ranking-card-"));
check("HStix flow does not show personalised UI", page.includes("!isHstixMode && isPersonalised"));
check("HStix sweet component type is returned and visibly labelled",
  glucosePatterns.includes("sweetCategory: validatedSweetCategory(food.item)") &&
  page.includes("pattern_component_type_${activeFood.componentType}"));
check("Partner insights render inside the measured HStix card branch",
  page.includes("glucose-partner-dominant") &&
  page.includes("glucose-partner-comparison") &&
  page.includes("glucose-partner-disclaimer") &&
  page.includes("<Trans") &&
  [en, zhHant, yue].every(locale =>
    locale.includes("<food>{{partner}}</food>") &&
    locale.includes("<food>{{higherPartner}}</food>") &&
    locale.includes("<food>{{lowerPartner}}</food>")));
check("Reliability calculations remain server-only and statistics-free in the UI",
  !/(reliability|standard error|variance|confidence interval)/i.test(page));
check("Meal and the retained manual HStix write invalidate the live Glucose Patterns query",
  snap.includes('invalidateQueries({ queryKey: ["/api/snap/glucose-patterns"] })') &&
  (postMeal.match(/invalidateQueries\(\{ queryKey: \["\/api\/snap\/glucose-patterns"\] \}\)/g)?.length ?? 0) === 1);
check("Both pattern groups are request-time reads with no server result cache",
  routes.includes("getMealSnapsForGlucosePatterns") &&
  routes.includes("getMealSnapsForHstixCards") &&
  !glucosePatterns.includes("resultCache"));
check("The two unchanged statistical bars document their different guidance and sample floors",
  glucosePatterns.includes("25 food-present and 25 food-absent") &&
  glucosePatterns.includes("const HSTIX_RELIABILITY_THRESHOLD = 1.96") &&
  twoMonth.includes("4-10 eligible meals") &&
  twoMonth.includes("export const Z_SCORE_GUARDRAIL = 1.4"));
check("The obsolete AI-only response and ranking path remain removed",
  !page.includes("aiOnlyList") &&
  !routes.includes("aiOnlyList") &&
  !storage.includes("getAiOnlyFoodRanking") &&
  !storage.includes("AiFoodEntry") &&
  !storage.includes("AVG(CASE"));
check("Navigation keeps exactly the five requested destinations",
  !nav.includes('key: "hstix"') &&
  !nav.includes('key: "health_info"') &&
  nav.includes('key: "home"') &&
  nav.includes('key: "report"') &&
  nav.includes('key: "snap"') &&
  nav.includes('key: "glucose"') &&
  nav.includes('key: "profile"') &&
  !nav.includes("overflowX") &&
  nav.includes("flex-1"));
check("Profile contains the three labeled personal shortcuts",
  profile.includes("profile-personal-shortcuts") &&
  profile.includes('path: "/hstix"') &&
  profile.includes('path: "/food-log"') &&
  profile.includes('path: "/health-info"') &&
  profile.includes("shortcut_glucose") &&
  profile.includes("shortcut_food_log") &&
  profile.includes("shortcut_health_info"));

console.log(`\n${passed} passed`);