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
Server-side push notifications via OneSignal REST API. Mobile wrapper (BuildNatively) handles the SDK side.

**4 Notifications:**
1. **Late Dinner Reminder** — 2 PM daily, only users with `lateDinnerScheduled = true` today. Deep link: `/`
2. **Sunday Planning Reminder** — 10 PM every Sunday, all registered users. Deep link: `/plan`
3. **Re-engagement** — 6 PM daily, users inactive 3+ days with 3-day cooldown. Deep link: `/`
4. **Daily Check-In Reminder** — 10 PM daily (except Sunday), all registered users. Deep link: `/`

**DB columns:** `onesignal_player_id` (text), `last_reengagement_notification` (timestamp) on `user_profiles`
**API:** POST `/api/onesignal/register` — stores player ID from BuildNatively JS bridge
**Scheduler:** `server/notifications.ts` — `setInterval` every 30 min, acts at hours 14, 18, 22
**Config:** `server/onesignal.ts` — OneSignal REST API wrapper using `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY` secrets

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

**Frontend:**
- `client/src/components/piggy-bank-svg.tsx` — inline SVG cartoon teal pig, 5 fill states (0–9, 10–24, 25–39, 40–54, 55–60 coins), sparkles when full; plain HTML SVG (compatible with web + Capacitor/WebView wrapper)
- Roadmap page: piggy bank card at top, CSS coin-drop animation on coin award, reward-setup modal (auto-shown when needsRewardSetup=true), congratulations modal when full