# Glukky

Glukky is a diabetes-aware life planner web application that helps users manage post-meal walks and dietary habits through a structured, adaptive, and gamified system.

## Run & Operate

- **Run:** `npm start`
- **Build:** `npm run build`
- **Typecheck:** `npm run typecheck`
- **Codegen (DB):** `drizzle-kit generate:pg`
- **DB Push (migrations):** `drizzle-kit push:pg`

**Required Environment Variables:**
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`
- `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_WEBHOOK_AUTH_HEADER` (for production)
- `GATE_MODE` ( `off`, `soft`, `hard`; default `soft`)

## Stack

- **Frontend:** React, TypeScript, Wouter (routing), TanStack React Query (data fetching), Tailwind CSS, Shadcn UI, Framer Motion (animations)
- **Backend:** Express.js, Node.js
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Authentication:** bcrypt (password hashing), express-session
- **Build Tool:** Vite

## Where things live

- **Database Schema:** `server/schema.ts`
- **API Contracts:** Defined implicitly by `server/api/*.ts` routes.
- **Frontend Source:** `client/src/`
- **Backend Source:** `server/src/`
- **Notification Logic:** `server/notifications.ts`, `server/onesignal.ts`
- **Paywall & Gating Logic:** `server/gate.ts`
- **Food Snap Logic:** `server/food-snap.ts`
- **Achievement Triggers:** `server/achievements.ts`
- **Build-time Info:** `server/build-info.ts`
- **Blog Site:** `blog-site/` (separate static site)
- **UI Components:** `client/src/components/`
- **Core Engine Logic:** `server/engine.ts` (do not modify without explicit request)
- **Diet Tip Ladders:** `shared/schema.ts`
- **UI Tip Icons:** `client/src/pages/monthly-report.tsx` (for `DIET_TIP_LADDERS` icons)

## Architecture decisions

- **Decoupled Blog Site:** A separate, plain-HTML static site (`blog-site/`) is used for SEO and content, completely decoupled from the main Glukky app to simplify deployment and avoid package manager issues in the Replit environment.
- **OneSignal `send_after` for Notifications:** Push notifications are pre-scheduled via OneSignal's `send_after` functionality to offload trigger-time ownership from the application's autoscale instance.
- **Soft Paywall Gating:** Instead of hard 403 errors, gated API endpoints return a 200 JSON response with `showPaywall: true` to enable a smoother in-app paywall presentation.
- **RevenueCat Aliasing for iOS Purchases:** Purchases are linked to Replit user IDs server-side by aliasing anonymous RevenueCat subscriber IDs, removing dependency on the Build Natively wrapper's `Set Customer ID` feature.
- **Self-Learning FoodSnap Pipeline:** Employs a multi-stage process with a combo database and advice cache to reduce reliance on expensive Claude API calls for food recognition and advice generation.

## Product

- **Weekly Goal System:** Automated negotiation, escalation/de-escalation for walk goals and diet progression.
- **Progressive Diet Mastery:** 3-week cycles and "tip ladders" for overcoming dietary challenges.
- **Gamified Piggy Bank:** Users earn coins for health achievements, redeemable for self-set rewards.
- **Fatigue Detection:** Proposes rest days and dynamically adjusts future walk plans.
- **Info Card Popups:** Contextual educational cards appearing at key user journey moments.
- **Mobile-Responsive UI:** Optimized for various screen sizes with a focus on intuitive daily check-ins and planning.
- **Push Notifications:** Reminders for late dinners, daily check-ins, weekly planning, and re-engagement.
- **Subscription Paywall:** Gates premium features with a soft, user-friendly flow.
- **Bilingual Blog Site:** Provides SEO-optimized articles in English and Traditional Chinese, with citations to published research.

## User preferences

I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the `server/engine.ts` file without explicit request.
I prefer to be asked before any significant modifications are made to the core algorithms, especially those related to walk negotiation and diet struggle systems.
I prefer clear communication regarding the purpose and impact of any proposed changes.
When adding new diet tips to DIET_TIP_LADDERS in shared/schema.ts, also add an icon entry to TIP_ICON_MAP in client/src/pages/monthly-report.tsx and ask the product owner to assign a lucide icon.

**Blog article writing rules (`blog-site/src/content/articles/`):**
- Do **not** write in "according to research / a 2022 study found / a 2016 paper showed" prose style. State the conclusion in plain language and let the superscript citation (`<sup><a href="#src-N">N</a></sup>`) carry the evidence trail. Reserve study names and journal references for the `sources` array at the end of each article.
- Prefer **direct quotes** from sources over my own interpretation. My interpretations have been only partially correct in past drafts. When a paraphrase is unavoidable, stay strictly inside what the source actually measured — never extend a finding past its scope, and never invent statistics, percentages, or numeric ranges that are not in the source.
- Articles in the `*.zh-Hant.mjs` files must be written in **formal Traditional Chinese** (suitable for a wider Trad-Chinese reading audience), not HK Cantonese colloquial. HK-specific facts (CHP guidelines, local food references) stay accurate via the citation, but framing prose stays in formal Trad Chinese.
- Citation entries (`sources[].label` and `sources[].publisher`) stay in **English in every locale**, regardless of the article language. Do not translate study titles, journal names, or organisation names into Chinese.

## Data-use restrictions

User health data — including glucose readings, post-meal symptoms, food logs, medication details, dietary struggles, and sleep patterns — is collected solely to deliver the app's personalised health-planning features to the individual user who provided it.

**This data must not be used for:**
1. AI/ML model training or fine-tuning (including prompting any model with identifiable user health records as training examples).
2. Research studies, academic analysis, or aggregated cohort analysis of any kind.
3. Sharing with any third party beyond the three consented services below.

**Permitted third-party data flows (all require explicit user consent):**
- **PostHog** — behavioural analytics only; all health fields and PII are stripped by `BLOCKED_KEYS` before any event leaves the device or server (MCHK §1.4.1). User IDs are SHA-256 hashed server-side.
- **Claude (Anthropic)** — food recognition and dietary advice for the individual user's current session only; gated by per-user `claude` consent record (MCHK §5).
- **OneSignal** — push notification delivery; no health values appear in notification content; gated by per-user push consent (MCHK §5).

These rules are enforced in code at the data-exit points (MCHK §6). Any proposed change that would send health data to a new destination, use stored records for model training, or enable population-level analysis must be explicitly approved by the product owner before implementation.

## Gotchas

- **Paywall Price Hardcoding:** The paywall headline price is hardcoded in locale files (`en.json`, `zh-Hant.json`, `yue.json`). Changing the price requires editing these strings directly.
- **WebView Staleness:** After deployment, if changes aren't visible on iOS, force-quit and relaunch the app. The WebView relies on `Cache-Control: no-store` for `index.html` to fetch the latest version.
- **RevenueCat Restore Behavior:** The RevenueCat project setting "Restore behavior" *must* be set to "Transfer to new App User ID" for restores to work correctly after reinstallation or signing in with a different account.
- **OneSignal Timezone Handling:** DST is handled by re-resolving `Intl.DateTimeFormat` UTC offset at the candidate trigger instant for notifications.
- **Blog Site Build:** The blog site uses a custom Node build script (`blog-site/build.mjs`) with zero npm dependencies due to Replit sandbox limitations.

## Pointers

- **RevenueCat API Reference:** _Populate as you build_
- **OneSignal API Reference:** _Populate as you build_
- **Drizzle ORM Documentation:** _Populate as you build_
- **Tailwind CSS Documentation:** _Populate as you build_
- **React Query Documentation:** _Populate as you build_
- **Framer Motion Documentation:** _Populate as you build_