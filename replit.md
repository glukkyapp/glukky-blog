# GlucoPlanner - Diabetes-Aware Life Planner

## Overview
A mobile-responsive web app that helps diabetes patients manage post-meal walks and diet habits through a weekly goal system with automated negotiation, escalation/de-escalation, and progressive diet mastery.

## Tech Stack
- **Frontend**: React + TypeScript, Wouter (routing), TanStack React Query, Tailwind CSS, Shadcn UI, Framer Motion
- **Backend**: Express.js, PostgreSQL (Drizzle ORM), Email/Password Auth (bcrypt + express-session)
- **Notifications**: Email notifications (planned, not yet integrated)

## Architecture
- `shared/schema.ts` - Drizzle database schema + types + constants (struggle priorities, tip ladders, mitigation trio)
- `shared/models/auth.ts` - Auth-related user/session tables (email + hashed password)
- `server/engine.ts` - Core algorithm engine (weekly planning, negotiation, diet progression, dinner graduation, fatigue detection)
- `server/routes.ts` - API endpoints (all require authentication)
- `server/storage.ts` - DatabaseStorage class with Drizzle ORM CRUD operations
- `server/db.ts` - Database connection pool
- `server/replit_integrations/auth/` - Email/password auth (bcrypt, express-session, connect-pg-simple)

## Auth System
- Email + password registration and login
- Passwords hashed with bcrypt (10 rounds)
- Sessions stored in PostgreSQL via connect-pg-simple
- Landing page has tabbed login/register form
- Auth endpoints: POST /api/auth/register, POST /api/auth/login, POST /api/auth/logout, GET /api/auth/user
- isAuthenticated middleware sets req.user.claims.sub for backward compat with routes

## Key Algorithm (DO NOT MODIFY without explicit request)
1. **Walk Negotiation**: Frequency-first (+1 day if <5/7), then duration (+5 min, cap 20), then Standing Reset (2 min)
2. **Late Dinner Priority**: Weekly plan selections override profile baseline. If user selects late dinner days → dinner focus (unless mastered). If user selects 0 late dinner days → no dinner focus, diet struggle activates instead. Labels: Move Early / Fiber Starter / Dusk Prep / Split Dinner. Graduation at >95% over 3 weeks. Override logic in routes.ts post-processing (engine.ts untouched).
3. **Diet Struggle Queue**: Sugary Food/Drink → Oily/Fried Food → Eat Out → Portions → Snacks. Clean Week Rule for tip advancement.
4. **Bi-Weekly Triggers**: Walking Bridge (0 walks over 2 weeks → enter stretch mode), Auto-Escalation (100% stretch for 2 weeks → offer 5-min walks), Stagnation Pivot
5. **Walking Bridge / Stretch Mode**: When `isStretchMode=true`, walk day picker relabels to "stretch days" with 2-min duration. `stretchSuccessWeeks` tracks consecutive 100% stretch weeks. After 2 → auto-escalation offer. Calendar/check-in labels say "stretch" instead of "walk". Empty week offers stretch via `stretchOffer` step. `stretchOnly` flag in plan creation overrides walk durations to 2 without changing profile baseline.
6. **Fatigue Detection**: Same day "Tired" 3/3 weeks → propose Rest Day
7. **Bridge Lock**: During standing reset (walkDuration === 2), negotiations (add_day, add_minutes, standing_reset) are disabled; only keep_current and set_rest_day available
8. **Next-Day Adjustment**: When tired after walk check-in: completed+tired → hydration advice popup; failed+tired+walk tomorrow → reduce tomorrow's walk by 5 min (floor 2); failed+tired+no walk tomorrow → hydration advice only
9. **Late Dinner Pivot**: When last week's dinner-early success was 0%, 2pm check-in skips "move earlier?" question → shows tactic picker directly with option to try moving early anyway

## Pages
- `/` - Landing (login/register tabs when not authenticated)
- `/` - Homepage with time-gated daily check-in + weekly calendar:
  - **Before 2pm**: read-only "Today's Plan" (no buttons)
  - **2pm–10pm**: dinner question only (if today is a late dinner day) — "Can you move dinner earlier?" Yes → move_early label; No → pick tactic
  - **After 10pm**: dinner follow-up (did you follow through?) + walk check-in + diet check-in
  - **After recording**: toast "Recorded!" → shows tomorrow's plan (read-only)
- `/plan` - Weekly planner:
  - **Week 1, no plan yet**: Shows "Plan Your First Week" immediately (any day/time). If mid-week, days before tomorrow are grayed out (disabled) in day selection. `firstActiveDay` stored on plan (0=Mon, 6=Sun).
  - **Week 1, plan exists**: Shows "Your first week's report is pending!"
  - **Week 2+, Mon–Sat**: Shows read-only weekly report for previous week (no planning available)
  - **Sunday after 6pm**: Full planning flow unlocked:
    - **First week**: walkDays → eatOutDays → lateDinnerDays → [dinnerFocusReview if dinner focus] → [dietReview if struggle] → preview
    - **Week 2+**: weeklyReport → walkDays (with negotiation + pre-fill) → eatOutDays → lateDinnerDays → [dinnerFocusReview] → [dietReview] → preview
  - **Monthly report message** shown at bottom of planner tab: "Your monthly report will be available on [last day of month]" or "available today!" on last day
  - **dinnerFocusReview**: Shows "Late Dinner Management" focus, graduation progress (success %, 3-week indicator), available tactics. Only when isDinnerFocus && no currentStruggle
  - **dietReview**: Shows current struggle, tip advance/repeat/mastered status, this week's tip. Only when currentStruggle is set
  - **Preview** includes focus section: dinner focus or diet struggle with tip
  - Dinner negotiation (move early? / pick tactic) happens at daily check-in, NOT during weekly planning
  - Late dinner days shown to ALL users regardless of profile settings
  - Weekly Report shows: Physical (walk stats), Late Dinner (early/tactic stats), Diet Struggle (yes/no/no-chance counts)
  - Diet gatekeeper: clean week (no "No") → advance tip; any "No" → repeat; all tips cleared → next struggle
- `/roadmap` - Weekly progress view with completion rates and diet tip tracking
- `/profile` - User profile, current focus, upcoming struggles
- `/monthly` - Monthly deep dive with 3 flash cards

## Developer Debug Panel
- Route: `/dev` — only accessible to users whose email is in `DEV_EMAILS` array in `server/routes.ts`
- Current dev emails: `yusycyn@gmail.com`
- Backend endpoints (all protected by `isDevUser` middleware except `/api/dev/check` and `/api/dev/time`):
  - `GET /api/dev/check` — returns `{isDev: boolean}` for current user
  - `GET /api/dev/state` — full profile + plan + logs for inspection
  - `GET /api/dev/time` — returns current time override (null if none)
  - `POST /api/dev/set-week` — set `currentWeek` on profile
  - `POST /api/dev/set-profile` — update profile fields
  - `POST /api/dev/set-time` — set simulated hour override (stored in memory via `devTimeOverrides` Map)
  - `POST /api/dev/generate-history` — auto-create past weekly plans + daily logs
- Frontend (`client/src/pages/dev-panel.tsx`):
  - Time Override: 8am, 2pm, 6pm, 10pm, 11pm, or Real time
  - Week Control: Set week 1–12
  - Profile State: Toggle hasLateDinner, dinnerMastered; set struggle, tipIndex, walkDuration, walksPerWeek, dinnerSuccessWeeks
  - Generate History: N weeks with configurable walk/diet success rates
  - Current State Inspector: Raw JSON of profile + plan
- Time override in `home.tsx`: `effectiveHour` from `/api/dev/time` replaces `currentHour` for `show2pmWindow` and `show10pmWindow` gating

## Database Tables
- `users` - Auth (id, email, hashed password)
- `sessions` - Express sessions (connect-pg-simple)
- `user_profiles` - Baseline data, current struggle, dinner state, stretch mode (`is_stretch_mode`, `stretch_success_weeks`)
- `weekly_plans` - Walk/diet goals per week, includes `first_active_day` (0=Mon default, for mid-week week-1 signup)
- `weekly_plan_days` - Per-day walk schedule + eat-out flag + late-dinner flag + dinner labels (set at check-in)
- `daily_logs` - Daily check-in data
- `weekly_reports`, `monthly_reports` - Generated reports

## Color Theme
- Primary: Teal green (#14A085 / hsl 166 48% 35%)
- Background: Soft mint cream
- Accent: Warm amber
- Nav bar: Soft teal pill-shaped floating bar
