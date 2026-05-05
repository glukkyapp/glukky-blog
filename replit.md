# Glukky - Diabetes-Aware Life Planner

## Overview
Glukky is a mobile-responsive web application designed to assist individuals with diabetes in managing post-meal walks and dietary habits. It utilizes a weekly goal system featuring automated negotiation, escalation/de-escalation mechanisms, and a progressive diet mastery program. The project aims to empower users to better control their blood sugar levels through structured and adaptive lifestyle planning.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the `server/engine.ts` file without explicit request.
I prefer to be asked before any significant modifications are made to the core algorithms, especially those related to walk negotiation and diet struggle systems.
I prefer clear communication regarding the purpose and impact of any proposed changes.
When adding new diet tips to DIET_TIP_LADDERS in shared/schema.ts, also add an icon entry to TIP_ICON_MAP in client/src/pages/monthly-report.tsx and ask the product owner to assign a lucide icon.

## System Architecture
The application is built with a React + TypeScript frontend, utilizing Wouter for routing, TanStack React Query for data fetching, Tailwind CSS and Shadcn UI for styling, and Framer Motion for animations. The backend is an Express.js application, with data persistence handled by PostgreSQL via Drizzle ORM. User authentication is managed through an email/password system using bcrypt and express-session.

**Core Features & Logic:**
- **Weekly Planning Engine:** Manages walk schedules, diet progression, and fatigue detection.
- **Walk Negotiation:** Implements a 4-scenario system for adapting walk goals based on user performance and engagement, including concepts like "Glycemic Gap" education and "Standing Tap" suggestions.
- **Per-Day Walk Duration:** Allows for flexible daily walk durations with minimum enforcement based on previous week's performance.
- **Standing Tap:** A unique 1-minute foot-tapping exercise for non-walk days to mitigate glucose spikes.
- **Late Dinner Priority:** A system to encourage earlier dinners or provide tactics for managing late meals. Graduation uses a 3-week window evaluation (matching the diet struggle strategy): scans the last 3 weeks with dinner data, aggregates success across all of them, and graduates at 80%+ success. Non-consecutive — switching to a different focus does not reset progress.
- **Diet Struggle System:** A progressive mastery program for dietary challenges (e.g., sugary foods, portions), involving 3-week cycles and tip ladders. Supports two cycles: when all List 1 struggles have been practiced (or are mastered), the user is prompted to build a "List 2.0" via a repick step in the planner. `profile.currentStruggleCycle` (1 or 2) controls which list governs plan creation. Fields: `repickPending`, `currentStruggleCycle`, `struggles2`, `masteredStruggles2`, `skippedStruggles2`, `difficultStruggles2`.
- **Bi-Weekly Triggers** (checked every week when `currentWeek >= 3`): Includes "Walking Bridge" for inactive users, "Auto-Escalation" for consistent stretch success, and "Stagnation Pivot" for diet.
- **Health Markers:** The `user_profiles` table includes nullable `hba1cLevel` (real) and `bloodTestDate` (date) fields. These are editable from the profile page via PATCH `/api/profile/health-markers`.
- **Fatigue Detection:** Proposes rest days after consistent "tired" feedback.
- **Next-Day Adjustment:** Dynamically alters tomorrow's walk plan based on today's performance and fatigue. Only applies in walk weeks — stretch weeks are never modified by fatigue logic.
- **Stretch Week Detection:** `isStretchWeek` boolean on `weekly_plans` table, set at plan creation from `profile.isStretchMode`. This is a historical snapshot — changing stretch mode later does not alter past plans. Replaces the old `adjustedToStretch` column (removed).

**UI/UX Decisions:**
- **Info Card Popups:** 9 contextual educational cards that appear once at key moments in the user journey (first home visit, diet tip selection, dinner focus, stretch switch, walk escalation, glycemic gap, roadmap visit, piggy bank, dinner tactics). Managed via `useInfoCard(id)` hook with localStorage dismissal. Component: `client/src/components/info-card-popup.tsx`. i18n keys under `info_card.*` namespace in all 3 locale files.
- **Color Scheme:** Primary teal green (#14A085), soft mint cream background, warm amber accents, and a soft teal pill-shaped floating navigation bar.
- **Homepage:** Time-gated daily check-ins (before 2pm, 2pm-10pm, after 10pm) with dynamic prompts for dinner questions, walk check-ins, and diet check-ins. Includes a "Catch-up mode" for missed Sunday check-ins.
- **Weekly Planner (`/plan`):** Guides users through setting weekly goals, displaying previous week's reports, and offering detailed customization for walk durations and diet tips. Includes specific review sections for dinner focus and diet struggles.
- **Reporting:** Displays weekly and monthly progress, completion rates, and diet tip tracking.
- **Developer Debug Panel (`/dev`):** Provides tools for authorized developers to inspect state, override time, set profile parameters, and generate historical data for testing.

## Push Notifications (OneSignal)
Pre-scheduled via OneSignal `send_after` so trigger-time ownership lives on OneSignal's side, not our autoscale instance. Mobile wrapper (BuildNatively) handles the device-side SDK.

**4 Notifications (per-user local time):**
1. **Late Dinner Reminder** — 2 PM local, only users with `lateDinnerScheduled = true` for that local weekday. Deep link: `/`
2. **Daily Check-In Reminder** — 10 PM local every day except Sunday, all registered users. Deep link: `/`
3. **Weekly Report (Sunday Planning)** — 10 PM local every Sunday, all registered users. Deep link: `/plan`
4. **Re-engagement** — 6 PM local, users inactive 3+ days with 3-day cooldown. Deep link: `/`

**DB columns on `user_profiles`:** `onesignal_player_id`, `onesignal_external_id` (= app user id, preferred target), `device_timezone`, `last_reengagement_notification`
**Dedup table:** `scheduled_notifications` (user_id, type, local_trigger_date, send_at_utc, onesignal_notification_id) with unique index on `(user_id, type, local_trigger_date)` — race-safe via `onConflictDoNothing`
**API:**
- POST `/api/onesignal/register` — stores player ID from BuildNatively JS bridge (legacy fallback target)
- POST `/api/onesignal/external-id` — stores wrapper-confirmed external_id (= authenticated user id); strict hijack guard
- GET `/api/uptime/ping` — public, kicks the autoscale instance awake so the hourly pre-scheduling pass runs (no longer load-bearing for delivery time)

**Scheduler:** `server/notifications.ts` — boot pass + hourly pass, each with a 36 h forward window. For every (user, type) whose next local trigger falls inside the window and isn't already in the dedup table, it POSTs to OneSignal with `send_after` set to the local trigger time and persists the row only on a successful POST. DST handled by re-resolving `Intl.DateTimeFormat` UTC offset at the candidate trigger instant.
**OneSignal target rules (`server/onesignal.ts`):**
- Rule A: every send sets `target_channel: "push"` and uses `include_aliases: { external_id: [...] }` when an external_id is present
- Rule B: rejects past `send_after` to avoid silent immediate-fire
- Rule C: falls back to `include_subscription_ids: [player_id]` when no external_id is registered yet
**Config:** `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY` secrets
**Logs to grep:** `notif/queued`, `notif/pass-complete`, `notif/race-detected`, `onesignal/external-id`

## Subscription Paywall Gate System
Soft-gating system for premium features. Uses `GATE_MODE` env var (`off`/`soft`/`hard`, default `soft`).

**DB columns on `user_profiles`:** `has_created_first_weekly_plan`, `has_tried_first_food_snap`, `has_reached_paywall`, `is_premium` (all boolean, default false)

**Gate logic (`server/gate.ts`):**
- `canUseFeature(profile, featureKey)` returns `{ allowed, showPaywall?, lockApp?, isFreeAction? }`
- Feature keys: `homepage`, `weekly_plan_create`, `food_snap_capture`, `food_snap_advice`, `roadmap`, `diet_advice`, `insights`
- Free users get: first weekly plan, first food snap label; blocked on advice after first snap, locked nav items after paywall reached
- Blocked endpoints return 200 JSON `{ success: false, showPaywall: true }` (not HTTP 403)

**API:** GET `/api/gate-status`, POST `/api/update-premium-status { isPremium: boolean }`

**Milestone flags (set server-side):** `hasCreatedFirstWeeklyPlan` on plan creation, `hasTriedFirstFoodSnap` on first food label return, `hasReachedPaywall` when advice endpoint blocks

**NativelyPurchases integration (`client/src/lib/natively-purchases.ts`):**
- Constructor-style: `new NativelyPurchases().purchasePackage("$rc_monthly", callback)`
- Auto-sync on app load via `getCustomerInfo()` → POST to `/api/update-premium-status`
- Non-native fallback: "Please open this app on your iPhone to subscribe."
- Paywall headline price is **hardcoded** in each locale file (`paywall.headline` key in `en.json` / `zh-Hant.json` / `yue.json`) as `HK$28`. The modal no longer fetches the price on open — no async tick, no flicker. To change the price, edit the three locale strings.
- `getMonthlyPriceDetails()`: 8s-bounded RevenueCat price fetch, **diagnostics-only**. Used by the dev panel pricing card and the `/api/diag/paywall-price` endpoint to surface wrapper-bridge breakage (e.g. `source=null-no-getOfferings`). Always resolves; tagged `[paywall-price]` warnings on every null path (no-bridge, no-getOfferings, timeout, no-current, no-monthly-package, empty-string). Not wired into the paywall headline anymore.
- `/api/build-info`: returns running build sha (from REPLIT_DEPLOYMENT_ID / GITHUB_SHA / etc), startedAt, NODE_ENV. Surfaced on dev panel to detect stale cached webview bundles.

**Frontend:**
- `PaywallModal` (`client/src/components/paywall-modal.tsx`) — bottom sheet with subscribe/restore buttons
- `useGate()` context from App.tsx — provides gate status and `showPaywall()` function
- Nav bar locks tabs (shows lock icon) when feature is gated
- Snap page: advice API gated response triggers paywall with resume-after-purchase callback
- Profile page: "Restore Purchases" button (only visible in native wrapper)
- Dev panel: NativelyPurchases probe card

## RevenueCat / Natively wrapper
iOS purchases are attached to the signed-in Replit user id **server-side** by aliasing the device's anonymous RevenueCat subscriber id (`$RCAnonymousID:…`) onto the Replit user id via RC's REST API. This removes the dependency on the Build Natively wrapper exposing a `Set Customer ID` (`logIn`) capability — that toggle does not exist in the current Build Natively dashboard, but the alias path works on every wrapper that already exposes purchase + restore + customerInfo.

**Architecture:**
- Bridge returns `customerInfo.original_app_user_id` (the anonymous id) from `purchasePackage` / `restorePurchases`.
- Client posts that id to `POST /api/revenuecat/alias-anonymous` (authenticated). Server validates it looks like `$RCAnonymousID:…` (rejects anything else to prevent hijack), calls RC's `POST /v1/subscribers/{anon}/alias` with `{ new_app_user_id: <replitUserId> }` using `REVENUECAT_SECRET_API_KEY`, invalidates the entitlement cache for that Replit user id, and remembers the mapping in-memory (TTL 7 days) for the webhook fallback.
- The existing verify-retry loop in the paywall picks up the merged subscriber on the next `/refresh-premium-status` and flips `is_premium` true.
- Webhook fallback: when an `INITIAL_PURCHASE` arrives whose only candidate ids are anonymous (rare — client closed the app before step 1), `applyWebhookEvent` consults the same in-memory mapping to route the entitlement to the right user. No mapping → existing `no_user` outcome.
- Subsequent purchases / renewals on the same RC subscriber don't need to re-alias (the alias is sticky on RC's side).

**Required Natively bridge capabilities (RevenueCat plugin):**
- `Get Customer Info` — required to read `original_app_user_id` after purchase / restore so the alias call has something to send.
- `Restore Purchases` — required for the paywall's Restore button and for picking up entitlements purchased before the user signed in.
- `Get Offerings` — required for live price-string fetch.
- `Set Customer ID` (`logIn`) — **optional**. When present we still call it (via `ensureIdentified`) so purchases land on the right RC subscriber from the start instead of being aliased after the fact. When absent, the alias path covers it; the paywall does not block.

**Sanity checklist (run on a real device after every Natively re-export or paywall change):**
1. Cold-launch the app, sign in, open the paywall, run a sandbox purchase. Within ~8s the server log should show `[revenuecat] alias ok anon=$RCAnonymousID:… replit=<replitId>` followed by `[revenuecat] verify hit user=<replitId> hasPremium=true` and the paywall should auto-close.
2. Sign out / sign back in on a previously-purchased sandbox account, tap Restore, confirm the alias log fires and the entitlement re-attaches.
3. Open `/dev` → "RevenueCat Diagnostics". On wrappers without `Set Customer ID` an amber note explains the alias path is in use; this is informational, not a failure.

**Identity & verdict badges:** RC identity is established up-front via the BN bridge's `purchases.login(userId, email, cb)`, called at auth resolve time so every purchase, restore, and webhook event is recorded against the real Replit user id from the start — no anonymous-id capture, no alias table, no self-healing alias walk. Every paywall trace event carries an `installId` (UUID stored under `glukky.installId` in localStorage) and ends with a `verdictBadge` of one of: `OK` / `AUTH_NOT_READY` / `BRIDGE_MISSING_PURCHASE` / `RC_ID_NEVER_OBTAINED` / `MAPPING_POST_FAILED` / `VERIFY_AFTER_MAPPING_FAILED` / `OTHER`. The latest verdict badge is also surfaced as a top-level `latestVerdictBadge` on `/api/diag/rc-state` for one-glance triage. The dev-panel "Bridge probe" card shows per-method `outcome` (missing/null/timeout/value/error) **plus** the actual `returned-value-X` payload (truncated, redacted) for read-only methods, covering both the canonical Build Natively names and alternative names (`getOriginalAppUserId`, `getAnonymousId`, `getAnonymousID`) used by other RevenueCat wrappers.

**Required RC dashboard setting — Restore Behavior:** The RC project must be set to **"Transfer to new App User ID"** (Project Settings → App → Restore behavior). This is the primary mechanism that lets a delete-and-reinstall on the same Apple ID re-attach the prior receipt to the new Replit user id when the Restore button is tapped. If the knob is wrong (e.g. set to "Keep" or "Reject"), restore returns SUCCESS at the bridge but the receipt stays on the deleted account's RC subscriber and `verifyEntitlement(newReplitUserId)` keeps returning 404 forever — users can't self-restore. Server-side defensive fallback: when `/api/refresh-premium-status` (force=true) returns `not_found` AND the device's bridge reported a `customerId` AND the RC subscriber at that id has an active receipt AND its `$email` attribute matches the signed-in user's email, the server calls RC's alias endpoint (`POST /v1/subscribers/{customerId}/alias` with the new Replit user id) to transfer the subscriber over and re-runs verify. Fail-closed: weak/ambiguous matches (no email match, no active sub) abort and log the reason. This fallback is a safety net, not a replacement for the dashboard setting — every `not_found` outcome also emits a `[premium/refresh] not_found …` warning so misconfiguration is visible in deployment logs.

**Restore-only stricter login gate:** The restore code path (`profile.tsx` Restore Purchases button → `restorePurchases()` in `client/src/lib/natively-purchases.ts`) blocks until `loginToRevenueCat(userId, email)` has actually returned `SUCCESS` (8s bounded wait via `waitForRevenueCatLogin`) before touching the BN bridge. This prevents the restore receipt from being recorded against an `$RCAnonymousID:…` subscriber when login is slow/silently failed. Failure modes surface distinct toasts: identity / login problems → "Couldn't verify your account for restore", bridge missing / timeout → "Couldn't reach the App Store", no active sub on this Apple ID → "No active subscription found". The bridge call uses a tighter 10s timeout (vs the default 30s on paywall present) so a hung BN callback is visible quickly. The paywall present calls (`presentPaywall` / `presentPaywallIfNeeded`) keep the looser best-effort `awaitLoginIfPending` so a transient login hiccup doesn't break a brand-new purchase. `logoutFromRevenueCat()` is intentionally only called on an auth-user switch — RC's `logout` creates a fresh anonymous subscriber, so calling it on every page load would orphan receipts.

**Single-paywall mutex:** The BN bridge wrapper holds a module-level `paywallInFlight: Promise<PaywallResult> | null`. Both `presentPaywall` and `presentPaywallIfNeeded` set it on entry and clear it in a `finally`; if non-null when either function is called, the existing promise is returned (with a `[paywall] … ignored — another paywall presentation is already in flight (mutex)` warn) instead of stacking a second native sheet. This makes the lock-app effect + a concurrent floating-nav-bar/snap/weekly-planner tap structurally safe regardless of which call site fires first. The double-paywall race that this mutex closes pre-dates the dead-code cleanup in #506 — #506's only runtime change was server-side webhook handling and is unrelated.

**Post-purchase background re-verify:** After `presentPaywall` returns `purchased` or `restored`, the unlocking overlay drives a fast 3-retry verify burst (~4.5s, 1.5s backoff). If that ends with `verifiedPremium=false`, a background poller takes over (`startBackgroundVerifyPoller` in `App.tsx`): it keeps the overlay up and polls `/api/refresh-premium-status` (force=true) every 3s for up to 60s, stopping the moment verify flips true. The poller is single-flight (any prior poller is cancelled when a new one starts) and cancels on logout / page-hide so it never polls a backgrounded or signed-out app. This eliminates the "Apple sheet says success, paywall closes, app stays locked, only force-quit recovers" failure mode on slow RC sandbox propagation.

**Restore-trace endpoint:** `POST /api/diag/restore-trace` (auth required) accepts `{ event, installId, …data }` and emits `[restore-trace] user=… install=… event=… {payload}` to the deployment console. The client posts at button tap, after the bridge result, and after server verify so the entire restore path is reconstructable from deployment logs alone.

**Webhook auth & Apple ASSN v2:** `POST /api/revenuecat/webhook` accepts events from RevenueCat. To prevent spoofing in production, set `REVENUECAT_WEBHOOK_AUTH_HEADER` to a long random string and configure the same value as the **Authorization header** in the RevenueCat dashboard webhook settings. The server requires an exact match before applying any event. Apple App Store Server Notifications **v2** are forwarded through RevenueCat — RC normalises them into its own event schema (`INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`, etc.) and posts to the same webhook. Do **not** wire Apple ASSN v2 directly to Glukky; let RevenueCat handle Apple's signed-payload verification and forward the normalised event. The webhook resolves the target user directly from the candidate ids in `app_user_id` / `original_app_user_id` / `aliases` — because `purchases.login` runs before any purchase, those candidates are already the real Replit user id; no alias-table fallback is consulted, and events that don't map to a known user end as `no_user`.

## Deployment notes
- Production static-serve sends `Cache-Control: no-store` for `index.html` and the SPA fallback (see `server/static.ts`) and `public, max-age=31536000, immutable` for `/assets/*`. Vite already fingerprints asset filenames, so a redeploy gets picked up on the next cold launch: WebView re-fetches `index.html`, sees new bundle filenames, fetches new JS/CSS automatically. `no-store` (vs the older `no-cache, must-revalidate`) prevents intermediate proxies/CDNs from holding the shell.
- Every served `index.html` (both prod static and dev Vite middleware) is post-processed to inject `<meta name="build-sha" content="…">` and `window.__BUILD_SHA__ = "…"`. The value comes from the same env vars `/api/build-info` reads (`REPLIT_DEPLOYMENT_ID` / `GITHUB_SHA` / etc) via `server/build-info.ts`. No edits to `package.json` or `vite.config.ts`.
- If a paywall or copy change is not appearing on the iPhone after deploy, force-quit the app once and relaunch — the cold launch re-fetches `index.html` because of the no-store header.

## WebView staleness diagnosis (TestFlight badge)
The diagnostic badge (top-right corner) appears on every screen — loading, language selection, onboarding, paywall — whenever `localStorage.devBadge === "1"`. Persistence is automatic: append `?debug=1` to the URL the iOS wrapper loads (once is enough — it's saved to localStorage and survives reloads/app restarts). To disable, append `?debug=0` once.

The badge shows three lines: `L:<loaded sha>` (the SHA baked into the HTML the WebView actually loaded, from `window.__BUILD_SHA__`), `S:<server sha>` (the SHA the deploy server is currently serving, from `/api/build-info`), and the `window.location.host`. SHAs are first 7 chars. Background turns red on mismatch.

A non-blocking yellow "Reload" banner appears at the top whenever `L != S`. It's safe-to-tap: it just calls `window.location.reload()`. The version check runs on app mount, on `visibilitychange → visible`, and when the paywall opens. It's throttled to once per minute and skipped while a purchase or restore is mid-flight (see `client/src/lib/purchase-in-flight.ts`).

Reading the badge:
- **L == S, but the layout/copy is still old** → the deploy itself is stale: the build step uploaded an old `dist/`. Rebuild and republish.
- **L != S** → the WebView is loading a stale shell. Tap the Reload banner. If reload doesn't change L, the iOS wrapper is pinned to a snapshot or older deploy URL — fix in the wrapper repo.
- **Host doesn't match the latest deploy URL** (e.g. shows an old `*.replit.app` or a snapshot URL) → the iOS wrapper's hardcoded URL is wrong; fix in the wrapper repo.

## External Dependencies
- **PostgreSQL:** Primary database for all application data.
- **Drizzle ORM:** Used for interacting with the PostgreSQL database.
- **bcrypt:** For hashing user passwords.
- **express-session:** For managing user sessions on the backend.
- **connect-pg-simple:** For storing session data in PostgreSQL.
- **TanStack React Query:** For server-state management in the frontend.
- **Wouter:** For client-side routing in the React application.
- **Tailwind CSS & Shadcn UI:** For styling and UI components.
- **Framer Motion:** For animations in the frontend.
- **OneSignal REST API:** For sending push notifications to mobile devices.

## Gamification: Piggy Bank
A coin-based reward system displayed on the Roadmap page. Users earn coins for health achievements; when 60 coins are collected the user claims a self-set personal reward and a new bank starts.

**DB additions:**
- `user_profiles`: `piggy_bank_coins` (int, default 0), `piggy_bank_reward` (text), `piggy_bank_needs_reward_setup` (bool, default true)
- `daily_logs`: `is_backfill` (bool) — true if log was submitted after the logged date (catch-up)
- New table `piggy_bank_events`: id, userId, achievementType, coinsAwarded, description, weekNumber, eventDate, createdAt

**Achievement triggers (server/achievements.ts):**
- *Daily* (fired in POST /api/log): walk complete (2), diet yes (2), dinner success (2), standing tap (1), walked longer than last week (1 per day)
- *Weekly* (fired in POST /api/plan/weekly): perfect walk week (2), diet clean week (2), no missed same-day check-ins (1), all stretch days completed (1)
- *Milestones*: dinner graduation (5), struggle graduation (5)

**API:** GET /api/piggybank, POST /api/piggybank/reward, POST /api/piggybank/claim

## FoodSnap Combo DB & Advice Cache
Self-learning food knowledge pipeline to reduce Claude API calls.

**3 New Tables:**
- `ingredient_vocabulary`: internal_id (unique), category (portion/sauce/topping), 3-locale labels, aliases array
- `food_combos`: foodName, foodNameEn, aliases, defaultPortion/Sauces/Toppings (internal_ids), caloriesEstimate
- `food_advice_cache`: foodName, comboKey (unique with locale), locale, adviceText

**Pipeline:**
1. `/api/snap/label`: Claude returns food name in the user's app language (locale-aware prompt) → DB combo lookup → if found, return pre-filled labels with internal IDs + sauceOptions/toppingOptions; if not, fallback Claude call for portion/sauces/extras
2. `/api/snap/advice`: Check advice cache by combo_key+locale → if cached, return immediately; if cache miss, generate advice in ALL 3 locales (en, zh-Hant, yue) in parallel, save all to DB, return user's locale only; also auto-save new food_combos on first encounter
3. `/api/snap/disambiguate`: Resolve user-typed text to internal ingredient IDs by category

**Seed script:** `scripts/seed-food-combos.ts` — 26 vocabulary items + 15 HK dish combos
**Frontend:** Portion chips (小/中/大) replace textarea; sauce/topping dropdowns (multi-select chips) when DB options available, with "Something else / 其他" option to switch to manual text input; internal IDs tracked in form state and sent to advice endpoint

**Frontend:**
- `client/src/components/piggy-bank-svg.tsx` — inline SVG cartoon teal pig, 5 fill states (0–9, 10–24, 25–39, 40–54, 55–60 coins), sparkles when full; plain HTML SVG (compatible with web + Capacitor/WebView wrapper)
- Roadmap page: piggy bank card at top, CSS coin-drop animation on coin award, reward-setup modal (auto-shown when needsRewardSetup=true), congratulations modal when full

## Glukky Blog Site (`blog-site/`) — bilingual SEO website

A separate, plain-HTML static site that lives entirely under `blog-site/` so the main Glukky React/Express app is **never touched**. Will be deployed to glukky.com; the existing app stays at its current host.

**Why plain HTML + tiny Node build script (not Astro/Next):** the sandbox blocks `bash npm i` and the packager paths for a non-root subfolder, so an off-the-shelf SSG was not set-up-able in this environment. The spec explicitly allowed "Plain HTML/CSS/JS if faster and cheaper", and a 10-page bilingual site is well within scope of a tiny Node script with zero dependencies.

**Structure:**
- `blog-site/build.mjs` — pure-Node static builder, renders `dist/` from templates + content articles. Generates sitemap.xml + robots.txt + favicon.svg automatically. Zero npm deps.
- `blog-site/serve.mjs` — pure-Node dev server on port 8080 (hard-coded — Replit injects PORT=5000 which we deliberately ignore). Rebuilds on every navigation request.
- `blog-site/src/templates/` — `layout.mjs` (head + header + footer with full SEO/hreflang/JSON-LD), `sections.mjs` (CTA, articleCard, FAQ, sources, breadcrumbs, JSON-LD helpers), `pages.mjs` (home, blogIndex, article, about, app).
- `blog-site/src/content/i18n.mjs` — every UI string for `en` + `zh-Hant`, plus `urlFor`/`articleUrl`/`altLocale`/`fmtDate`/`readingMinutes` helpers.
- `blog-site/src/content/articles/<slug>.<locale>.mjs` — one ES-module per article-locale pair (slug shared across languages).
- `blog-site/src/content/research/citations.md` — single source of truth mapping every claim in the launch articles to a real published source. **Rule: no claim ships without a citation in this file.**
- `blog-site/src/styles/global.css` — brand tokens (teal `hsl(166 48% 35%)`, cream `#fdfbee`) lifted from `client/src/index.css`; mobile-first; ZH font stack swap via `body.lang-zh`.
- `blog-site/public/images/` — copies of brand assets from `attached_assets/`.

**Routing model:** EN at `/`, `/blog`, `/blog/<slug>`, `/about`, `/app`. ZH-Hant at `/zh/`, `/zh/blog`, `/zh/blog/<slug>`, `/zh/about`, `/zh/app`. Slugs identical across languages so the language switcher always has a valid counterpart. Full `<link rel="alternate" hreflang>` triplet (`en` + `zh-Hant` + `x-default`) on every page; matching alternates in `sitemap.xml`.

**SEO plumbing:** unique title + description per page, canonical URL, OG/Twitter tags, Article + FAQPage JSON-LD on every article, Organization JSON-LD on home, sitemap.xml with hreflang annotations, robots.txt.

**Workflow:** `Glukky website dev` runs `node blog-site/serve.mjs` on port 8080 (console output type). The main `Start application` workflow on port 5000 is unaffected.

**Launch articles (4 — stop here for review per spec):**
1. `prediabetes-diet-where-to-start` (en + zh-Hant)
2. `post-meal-walk-blood-sugar` (en + zh-Hant)

All citations are to real, verifiable publications: NEJM (DPP / Knowler 2002), NIDDK, PREDIMED in Annals of Internal Medicine, ADA Standards of Care 2024, WHO healthy diet, NHS, HK Centre for Health Protection, DiPietro et al 2013 (Diabetes Care), Reynolds et al 2016 (Diabetologia), Buffey et al 2022 (Sports Medicine).

**Editorial guardrails enforced:** no banned vocab (cure, reverse, miracle, hack, "treat", "diagnose"); medical disclaimer on every article; no fabricated citations; HK food/cultural references throughout the ZH-Hant copy; "Glukky is not a doctor / not a diagnostic device" stated in About + each article disclaimer.
