/**
 * Task 870 regression contracts.
 *
 * These deliberately inspect the public source seams rather than requiring an
 * authenticated browser/database fixture. They protect the retirement of
 * automatic HStix prompting while keeping voluntary monitoring and the three
 * narrowly-scoped educational surfaces intact.
 *
 * Run with: npx tsx tests/task-870-guidance-contract.test.mts
 */
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";

const [
  app,
  postMeal,
  guidance,
  home,
  hstix,
  patterns,
  foodLog,
  snap,
  routes,
  notifications,
  oneSignal,
  index,
  schema,
  migrations,
  enSource,
  zhHantSource,
  yueSource,
] = await Promise.all([
  readFile("client/src/App.tsx", "utf8"),
  readFile("client/src/components/PostMealCard.tsx", "utf8"),
  readFile("client/src/components/glucose-monitoring-guidance.tsx", "utf8"),
  readFile("client/src/pages/home.tsx", "utf8"),
  readFile("client/src/pages/hstix.tsx", "utf8"),
  readFile("client/src/pages/glucose-patterns.tsx", "utf8"),
  readFile("client/src/pages/food-log.tsx", "utf8"),
  readFile("client/src/pages/snap.tsx", "utf8"),
  readFile("server/routes.ts", "utf8"),
  readFile("server/notifications.ts", "utf8"),
  readFile("server/onesignal.ts", "utf8"),
  readFile("server/index.ts", "utf8"),
  readFile("shared/schema.ts", "utf8"),
  readFile("server/startup-migrations.ts", "utf8"),
  readFile("client/src/locales/en.json", "utf8"),
  readFile("client/src/locales/zh-Hant.json", "utf8"),
  readFile("client/src/locales/yue.json", "utf8"),
]);

const en = JSON.parse(enSource);
const zhHant = JSON.parse(zhHantSource);
const yue = JSON.parse(yueSource);

let passed = 0;
function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  passed++;
}

const only = (text: string, values: string[]) =>
  values.every(value => text.includes(value));

// Retirement: no scheduled/template/event-based HStix reminder can return.
check("notification scheduler owns exactly the two remaining automatic types",
  notifications.includes('type NotificationType =\n  | "foodsnap_reminder"') &&
  notifications.includes('| "reengagement";') &&
  !notifications.includes("hstix_reminder"));
check("there is no HStix notification template, trigger, or server send path",
  !notifications.includes("HStix") &&
  !notifications.includes("hstix") &&
  !routes.includes("hstix_reminder") &&
  !routes.includes("hstixReminderNotificationId"));
check("the retired global nudge and automatic pending-reading prompt are absent",
  !app.includes("GlucometerNudge") &&
  !routes.includes("/api/snap/nudge-status") &&
  !routes.includes("/api/snap/pending-post-meal") &&
  !foodLog.includes("button-food-log-record-glucose-") &&
  !snap.includes("pending-post-meal"));

// Startup cleanup must only touch the legacy HStix id, be retry-safe, and not
// make an unrelated scheduled-notification decision.
const cleanup = oneSignal.slice(
  oneSignal.indexOf("export async function cleanupRetiredHstixReminderNotifications"),
  oneSignal.indexOf("// Best-effort delete of a user from OneSignal"),
);
check("startup invokes the dedicated retired-HStix cleanup before scheduling",
  index.includes("cleanupRetiredHstixReminderNotifications") &&
  index.lastIndexOf("cleanupRetiredHstixReminderNotifications") < index.lastIndexOf("startNotificationScheduler"));
check("cleanup selects only profiles with a legacy HStix notification id",
  cleanup.includes("notificationId: userProfiles.hstixReminderNotificationId") &&
  cleanup.includes("isNotNull(userProfiles.hstixReminderNotificationId)") &&
  !cleanup.includes("scheduledNotifications"));
check("cleanup keeps failed cancellations for the next startup but treats a 404 as absent",
  cleanup.includes("if (!result.ok && result.status !== 404)") &&
  cleanup.includes("retainedForRetry++") &&
  cleanup.includes("continue;"));
check("cleanup clears only the identical legacy id after confirmed cancellation",
  cleanup.includes(".set({ hstixReminderNotificationId: null })") &&
  cleanup.includes("eq(userProfiles.userId, profile.userId)") &&
  cleanup.includes("eq(userProfiles.hstixReminderNotificationId, notificationId)"));
check("cleanup remains bounded and idempotent under retries/concurrent writers",
  cleanup.includes("if (cleared.length > 0) cancelled++") &&
  cleanup.includes("setTimeout(resolve, 100)") &&
  cleanup.includes("retained_for_retry"));

// The old data model remains compatible, but automatic fasting/nudge UI and
// write payloads do not.
check("baseline historical schema fields remain available for existing records",
  only(schema, [
    'fastingBaselineMmol: real("fasting_baseline_mmol")',
    'fastingQuestionSeen: boolean("fasting_question_seen")',
    'glucometerNudgeShown: boolean("glucometer_nudge_shown")',
    'postMealSkipped: boolean("post_meal_skipped")',
    'postMealSymptom: text("post_meal_symptom")',
    'hstixReminderNotificationId: varchar("hstix_reminder_notification_id")',
  ]));
check("fasting questions and fasting payload values are removed from active UI/API flow",
  !postMeal.includes("fasting") &&
  !foodLog.includes("fasting") &&
  !snap.includes("fasting") &&
  !routes.includes("fastingBaseline") &&
  !routes.includes("fastingQuestionSeen"));
check("manual Home-to-HStix correction remains available",
  home.includes('data-testid="section-home-hstix"') &&
  home.includes("latestCorrectableReading") &&
  home.includes("hstix_home_change") &&
  home.includes('setLocation(`/hstix'));
check("manual HStix entry retains correction, low/high confirmation, and timing context",
  hstix.includes("validReadingId") &&
  hstix.includes("hstixReadingId={validReadingId}") &&
  hstix.includes("mealTimingConfidence") &&
  postMeal.includes("if (glucoseValue < 4.0)") &&
  postMeal.includes("if (glucoseValue > 13.0)") &&
  postMeal.includes('setAlertType("low")') &&
  postMeal.includes('setAlertType("high")'));

// Server acknowledgement is a closed, exhaustive three-kind API.
check("server whitelist and profile-field mapping have exactly the same three kinds",
  only(routes, [
    'hstix: "hstixMonitoringGuidanceSeen"',
    '"meal-pattern": "mealPatternGuidanceSeen"',
    '"food-pattern": "foodPatternGuidanceSeen"',
    '"hstix",',
    '"meal-pattern",',
    '"food-pattern",',
  ]) &&
  !routes.includes("guidanceKindSchema = z.string"));
check("both guidance endpoints validate the kind before reading or writing profile state",
  routes.includes('app.get("/api/user/glucose-guidance/:kind", isAuthenticated') &&
  routes.includes('app.post("/api/user/glucose-guidance/:kind/seen", isAuthenticated') &&
  (routes.match(/guidanceKindSchema\.safeParse\(req\.params\.kind\)/g)?.length ?? 0) === 2 &&
  (routes.match(/Invalid guidance kind/g)?.length ?? 0) === 2);
check("acknowledgement is guarded, idempotent, and reports a durable final state",
  routes.includes("if (profile[field] !== true)") &&
  routes.includes("await storage.updateProfile(userId, { [field]: true })") &&
  routes.includes('return res.json({ kind, seen: true })') &&
  routes.includes('return res.status(404).json({ message: "Profile not found" })'));
check("guidance schema fields are migrated with false defaults",
  only(schema, [
    'hstixMonitoringGuidanceSeen: boolean("hstix_monitoring_guidance_seen").notNull().default(false)',
    'mealPatternGuidanceSeen: boolean("meal_pattern_guidance_seen").notNull().default(false)',
    'foodPatternGuidanceSeen: boolean("food_pattern_guidance_seen").notNull().default(false)',
  ]) &&
  migrations.includes("user_profiles.guidance_seen_fields") &&
  migrations.includes("ADD COLUMN IF NOT EXISTS hstix_monitoring_guidance_seen boolean NOT NULL DEFAULT false"));

// Client-side decision/acknowledgement contract.
check("unresolved or failed status requests cannot make a candidate eligible",
  guidance.includes("ready: !status.isLoading && !status.isError") &&
  guidance.includes("candidate?.eligible && candidate.ready && !candidate.seen"));
check("visibility requires document visibility, rendered geometry, viewport intersection, and accessible ancestry",
  only(guidance, [
    'document.visibilityState !== "visible"',
    'element.closest(\'[aria-hidden="true"], [inert]\')',
    'style.display === "none"',
    'style.visibility === "hidden"',
    "Number(style.opacity) === 0",
    "rect.width > 0 && rect.height > 0",
    "rect.bottom > 0",
    "rect.top < window.innerHeight",
  ]));
check("visibility is reevaluated on scroll, resize, and document visibility changes",
  guidance.includes('window.addEventListener("scroll", reevaluate, true)') &&
  guidance.includes('window.addEventListener("resize", reevaluate)') &&
  guidance.includes('document.addEventListener("visibilitychange", reevaluate)'));
check("priority is fixed and a visit can open only one guidance modal",
  guidance.includes('const priority: GuidanceKind[] = ["hstix", "meal-pattern", "food-pattern"]') &&
  guidance.includes("shownThisVisit.current") &&
  guidance.includes("shownThisVisit.current = true") &&
  guidance.includes("if (shownThisVisit.current || active"));
check("candidate derivation is memoized across stable candidate/status contexts",
  guidance.includes("const memoizedCandidates = useMemo(") &&
  guidance.includes("candidates.map(candidate =>") &&
  guidance.includes("i18n.language"));
check("acknowledgement prevents duplicate posts, dismisses immediately, and updates caches only on success",
  guidance.includes("if (acknowledging.current) return") &&
  guidance.includes('await apiRequest("POST", `/api/user/glucose-guidance/${kind}/seen`, {})') &&
  guidance.indexOf("queryClient.setQueryData") > guidance.indexOf('await apiRequest("POST"') &&
  guidance.includes('console.warn("[glucose-guidance] acknowledgement failed", error)') &&
  /const kind = active;[\s\S]*setActive\(null\);[\s\S]*void acknowledgeGuidance\(kind\)/.test(guidance) &&
  guidance.indexOf("setActive(null)") < guidance.indexOf("void acknowledgeGuidance(kind)") &&
  !/finally\s*\{[\s\S]{0,120}setActive\(null\)/.test(guidance));
check("inline education is the fallback and hides only its own copy while its modal is active",
  guidance.includes("export function GlucoseGuidanceInline") &&
  guidance.includes("if (hidden) return null") &&
  hstix.includes('<GlucoseGuidanceInline kind="hstix" hidden={activeGuidance === "hstix"} />') &&
  patterns.includes('<GlucoseGuidanceInline kind="meal-pattern" hidden={activeGuidance === "meal-pattern"} />'));
check("each page supplies only its resolved contextual candidates",
  hstix.includes("eligible: showEntryForm && !validMealSnapId") &&
  patterns.includes("eligible: !isLoading && !isLocked && showPersonalisedProgress") &&
  patterns.includes("eligible: !!selectedFood && hasInsufficientFoodDetail") &&
  patterns.includes("!detailLoading && !!detailData?.detail"));

const expectedEnglish = {
  guidance_title: "About glucose monitoring",
  guidance_hstix_body: "Blood-glucose monitoring is not needed routinely for everyone. The timing and frequency of monitoring should be individualised to your needs and goals.",
  "guidance_meal-pattern_body": "More readings are needed before this app can show a pattern for your meals. Record glucose only when it helps answer a specific question about your meals or lifestyle changes.",
  "guidance_food-pattern_body": "More readings are needed before this app can show a pattern for this food. Consider recording only when it is relevant to your personal monitoring plan.",
  guidance_got_it: "Got it",
};
check("English guidance wording is exact",
  Object.entries(expectedEnglish).every(([key, value]) => en.glucose[key] === value));
check("Traditional Chinese and Cantonese use the identical supplied guidance translations",
  ["guidance_title", "guidance_hstix_body", "guidance_meal-pattern_body", "guidance_food-pattern_body", "guidance_got_it"]
    .every(key => zhHant.glucose[key] === yue.glucose[key]) &&
  zhHant.glucose.guidance_title === "關於血糖監測" &&
  zhHant.glucose.guidance_hstix_body === "並非每個人都需要常規監測血糖。監測的時間和頻率應按你的需要和目標而定。" &&
  zhHant.glucose["guidance_meal-pattern_body"] === "本應用程式需要更多讀數，才可顯示你的用餐模式。只在有助回答與你的餐點或生活方式改變有關的具體問題時記錄血糖。" &&
  zhHant.glucose["guidance_food-pattern_body"] === "本應用程式需要更多讀數，才可顯示此食物的模式。只在與你的個人監測計劃相關時才考慮記錄。" &&
  zhHant.glucose.guidance_got_it === "知道了");

console.log(`${passed} Task 870 guidance contracts passed`);