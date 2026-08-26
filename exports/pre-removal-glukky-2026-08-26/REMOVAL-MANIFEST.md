# Removal manifest and safety boundary

This is a pre-removal review document. Line ranges refer to the archived before-change snapshots and may shift during implementation.

## Group 1 — obsolete FoodSnap sugary/oily/snack tags

Remove only the unused tag system:

- `server/routes.ts`
  - `FoodTags`, `FocusPanelData`, and `computeFocusPanel()` near the file start.
  - `needTags`, `tagInstruction`, tag JSON parsing, tag persistence, and every `focusPanelData` response property in the snap-advice flow around the 4,000–4,530 range.
- `shared/schema.ts`
  - `food_labels.is_sugary_food`, `is_sugary_drink`, `is_oily`, and `is_snack`.
- `scripts/seed-food-db.ts`
  - Import assignments for the four obsolete tag fields.
- `client/src/pages/snap.tsx`
  - Unused `focusPanelData` response typing only.
- Any directly associated tag-only test/fixture references.

Preserve: `foodItems`, `FoodItemMetadata`, carb subtype classification, exact food-library lookup, advice caching, meal logging, glucose impact, HStix linkage, and glucose-pattern analysis.

## Group 2 — old planner notification/report names

Remove or simplify only planner-era notification code:

- `server/notifications.ts`
  - Notification type definitions and templates for `daily_report`, `weekly_report`, `monthly_report`, and `daily_checkin`.
  - Planner-only dev templates such as `late_dinner` and `sunday_planning`.
  - Dead retired eligibility branches and associated old dev-only send paths.
- `server/routes.ts` and `client/src/pages/dev-panel.tsx`
  - Planner-only notification type validation and test buttons.

Preserve exactly:

- `foodsnap_reminder` and its 7 PM meal-snap eligibility path.
- `hstix_reminder` and its post-snap 55-minute scheduling path.
- `reengagement`, its eligibility/rate limit, profile timestamp, active test button, and OneSignal send infrastructure.
- The `scheduled_notifications` table itself, because active notifications still use it.

## Group 3 — weekly planner system

Retire planner-only behavior, not the FoodSnap reporting system:

- `client/src/pages/weekly-planner.tsx`: planner UI, check-ins, reflection, planner history, planner-era reports, and planner progression UI.
- `client/src/pages/monthly-report.tsx`: planner-era `/monthly` report route/component.
- `client/src/App.tsx`: planner route/import/fallback/gate wiring only.
- `client/src/components/floating-nav-bar.tsx`, `client/src/lib/featureFlags.ts`, and `client/src/lib/prefetch-user-data.ts`: planner navigation/feature/prefetch wiring only.
- `client/src/pages/home.tsx`: planner calendar, check-ins, dinner/catch-up tasks, and plan-dependent home state only; preserve FoodSnap home/report behavior.
- `server/routes.ts`: planner `/api/plan/*`, planner `/api/log*`, planner calendar/reflection/report-seen/dinner-label paths, planner history-generation paths, and planner-only export/backup fields; preserve all `/api/snap/*`, `/api/hstix/*`, and FoodSnap logging paths.
- `server/engine.ts`: planner progression, struggle scheduling, escalation, dinner/eat-out/stretch, and plan-day calculations only.
- `server/storage.ts` and `shared/schema.ts`: planner tables and planner CRUD/export/deletion paths only, subject to preserving account safety and active FoodSnap/HStix records.
- `server/gate.ts`: planner-specific gates only; preserve FoodSnap/advice/paywall gates.
- Planner-only locale, illustration, and fixture references in the archived client/scripts/tests.

Preserve explicitly:

- `client/src/pages/report.tsx` and `client/src/pages/food-reports.tsx`.
- `/api/snap/daily-summary`, `/api/snap/weekly-summary`, and `/api/snap/monthly-summary`.
- FoodSnap meal history, HStix readings, glucose-pattern cards, carb classification, and active report calculations.

## Group 4 — stale re-engagement wording

Keep the active re-engagement path and change wording only:

- `server/notifications.ts` live `CONTENTS.reengagement` copy.
- `server/notifications.ts` dev re-engagement test copy.

Preserve the timing, eligibility, 14-day rate limit, profile timestamp, OneSignal behavior, and active test button.

## Retired-notification cleanup

`purgeRetiredTypes()` currently cancels future OneSignal messages and deletes old rows for the four retired notification types. It is not an active report feature. Before removing it, the implementation must account for any existing queued legacy rows; the active notification scheduler and `scheduled_notifications` table must remain.

## Historical migrations

Files under `historical-migration-references/` are included for context. They are migration history and are not targets for deletion. Any database shape retirement must use the project’s normal migration/publish process.
