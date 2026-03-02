# GlucoPlanner - Diabetes-Aware Life Planner

## Overview
A mobile-responsive web app that helps diabetes patients manage post-meal walks and diet habits through a weekly goal system with automated negotiation, escalation/de-escalation, and progressive diet mastery.

## Tech Stack
- **Frontend**: React + TypeScript, Wouter (routing), TanStack React Query, Tailwind CSS, Shadcn UI, Framer Motion
- **Backend**: Express.js, PostgreSQL (Drizzle ORM), Replit Auth (OpenID Connect)
- **Notifications**: Email notifications (planned, not yet integrated)

## Architecture
- `shared/schema.ts` - Drizzle database schema + types + constants (struggle priorities, tip ladders, mitigation trio)
- `shared/models/auth.ts` - Auth-related user/session tables (Replit Auth)
- `server/engine.ts` - Core algorithm engine (weekly planning, negotiation, diet progression, dinner graduation, fatigue detection)
- `server/routes.ts` - API endpoints (all require authentication)
- `server/storage.ts` - DatabaseStorage class with Drizzle ORM CRUD operations
- `server/db.ts` - Database connection pool
- `server/replit_integrations/auth/` - Replit Auth integration (OpenID Connect, sessions)

## Key Algorithm
1. **Walk Negotiation**: Frequency-first (+1 day if <5/7), then duration (+5 min, cap 20), then Standing Reset (2 min)
2. **Late Dinner Priority**: If user has dinner after 9pm, focus on dinner timing before diet struggles. Labels: Move Early / Fiber Starter / Dusk Prep / Split Dinner. Graduation at >95% over 3 weeks.
3. **Diet Struggle Queue**: Sugary Food/Drink → Oily/Fried Food → Eat Out → Portions → Snacks. Clean Week Rule for tip advancement.
4. **Bi-Weekly Triggers**: Walking Bridge, Auto-Escalation, Stagnation Pivot
5. **Fatigue Detection**: Same day "Tired" 3/3 weeks → propose Rest Day

## Pages
- `/` - Homepage (daily check-in + weekly calendar)
- `/plan` - Weekly planner (reflection + planning combined)
- `/roadmap` - Mastery roadmap with progress bars
- `/profile` - User profile, current focus, upcoming struggles
- `/monthly` - Monthly deep dive with 3 flash cards

## Database Tables
- `users`, `sessions` - Auth (Replit Auth)
- `user_profiles` - Baseline data, current struggle, dinner state
- `weekly_plans` - Walk/diet goals per week
- `weekly_plan_days` - Per-day walk schedule + dinner labels
- `daily_logs` - Daily check-in data
- `weekly_reports`, `monthly_reports` - Generated reports

## Color Theme
- Primary: Teal green (#14A085 / hsl 166 48% 35%)
- Background: Soft mint cream
- Accent: Warm amber
- Nav bar: Soft teal pill-shaped floating bar
