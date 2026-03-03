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
2. **Late Dinner Priority**: If user has dinner after 9pm, focus on dinner timing before diet struggles. Labels: Move Early / Fiber Starter / Dusk Prep / Split Dinner. Graduation at >95% over 3 weeks.
3. **Diet Struggle Queue**: Sugary Food/Drink → Oily/Fried Food → Eat Out → Portions → Snacks. Clean Week Rule for tip advancement.
4. **Bi-Weekly Triggers**: Walking Bridge, Auto-Escalation, Stagnation Pivot
5. **Fatigue Detection**: Same day "Tired" 3/3 weeks → propose Rest Day

## Pages
- `/` - Landing (login/register tabs when not authenticated)
- `/` - Homepage with time-gated daily check-in + weekly calendar:
  - **Before 2pm**: read-only "Today's Plan" (no buttons)
  - **2pm–10pm**: dinner question only (if today is a late dinner day) — "Can you move dinner earlier?" Yes → move_early label; No → pick tactic
  - **After 10pm**: dinner follow-up (did you follow through?) + walk check-in + diet check-in
  - **After recording**: toast "Recorded!" → shows tomorrow's plan (read-only)
- `/plan` - Weekly planner with two flows:
  - **First week**: walkDays → eatOutDays → lateDinnerDays → [dinnerFocusReview if dinner focus] → [dietReview if struggle] → preview
  - **Week 2+**: weeklyReport (stats only) → walkDays (with negotiation + pre-fill) → eatOutDays (pre-fill) → lateDinnerDays (pre-fill) → [dinnerFocusReview if dinner focus] → [dietReview if struggle] → preview
  - **dinnerFocusReview**: Shows "Late Dinner Management" focus, graduation progress (success %, 3-week indicator), available tactics. Only when isDinnerFocus && no currentStruggle
  - **dietReview**: Shows current struggle, tip advance/repeat/mastered status, this week's tip. Only when currentStruggle is set
  - **Preview** includes focus section: dinner focus or diet struggle with tip
  - Dinner negotiation (move early? / pick tactic) happens at daily check-in, NOT during weekly planning
  - Late dinner days shown to ALL users regardless of profile settings
  - Weekly Report shows: Physical (walk stats), Late Dinner (early/tactic stats), Diet Struggle (yes/no/no-chance counts)
  - Diet gatekeeper: clean week (no "No") → advance tip; any "No" → repeat; all tips cleared → next struggle
- `/roadmap` - Mastery roadmap with progress bars
- `/profile` - User profile, current focus, upcoming struggles
- `/monthly` - Monthly deep dive with 3 flash cards

## Database Tables
- `users` - Auth (id, email, hashed password)
- `sessions` - Express sessions (connect-pg-simple)
- `user_profiles` - Baseline data, current struggle, dinner state
- `weekly_plans` - Walk/diet goals per week
- `weekly_plan_days` - Per-day walk schedule + eat-out flag + late-dinner flag + dinner labels (set at check-in)
- `daily_logs` - Daily check-in data
- `weekly_reports`, `monthly_reports` - Generated reports

## Color Theme
- Primary: Teal green (#14A085 / hsl 166 48% 35%)
- Background: Soft mint cream
- Accent: Warm amber
- Nav bar: Soft teal pill-shaped floating bar
