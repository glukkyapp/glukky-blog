# GlucoPlanner - Diabetes-Aware Life Planner

## Overview
GlucoPlanner is a mobile-responsive web application designed to assist individuals with diabetes in managing post-meal walks and dietary habits. It utilizes a weekly goal system featuring automated negotiation, escalation/de-escalation mechanisms, and a progressive diet mastery program. The project aims to empower users to better control their blood sugar levels through structured and adaptive lifestyle planning.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the `server/engine.ts` file without explicit request.
I prefer to be asked before any significant modifications are made to the core algorithms, especially those related to walk negotiation and diet struggle systems.
I prefer clear communication regarding the purpose and impact of any proposed changes.

## System Architecture
The application is built with a React + TypeScript frontend, utilizing Wouter for routing, TanStack React Query for data fetching, Tailwind CSS and Shadcn UI for styling, and Framer Motion for animations. The backend is an Express.js application, with data persistence handled by PostgreSQL via Drizzle ORM. User authentication is managed through an email/password system using bcrypt and express-session.

**Core Features & Logic:**
- **Weekly Planning Engine:** Manages walk schedules, diet progression, and fatigue detection.
- **Walk Negotiation:** Implements a 4-scenario system for adapting walk goals based on user performance and engagement, including concepts like "Glycemic Gap" education and "Standing Tap" suggestions.
- **Per-Day Walk Duration:** Allows for flexible daily walk durations with minimum enforcement based on previous week's performance.
- **Standing Tap:** A unique 1-minute foot-tapping exercise for non-walk days to mitigate glucose spikes.
- **Late Dinner Priority:** A system to encourage earlier dinners or provide tactics for managing late meals, with graduation based on consistent success.
- **Diet Struggle System:** A progressive mastery program for dietary challenges (e.g., sugary foods, portions), involving 3-week cycles and tip ladders.
- **Bi-Weekly Triggers** (checked every week when `currentWeek >= 3`): Includes "Walking Bridge" for inactive users, "Auto-Escalation" for consistent stretch success, and "Stagnation Pivot" for diet.
- **Fatigue Detection:** Proposes rest days after consistent "tired" feedback.
- **Next-Day Adjustment:** Dynamically alters tomorrow's walk plan based on today's performance and fatigue.

**UI/UX Decisions:**
- **Color Scheme:** Primary teal green (#14A085), soft mint cream background, warm amber accents, and a soft teal pill-shaped floating navigation bar.
- **Homepage:** Time-gated daily check-ins (before 2pm, 2pm-10pm, after 10pm) with dynamic prompts for dinner questions, walk check-ins, and diet check-ins. Includes a "Catch-up mode" for missed Sunday check-ins.
- **Weekly Planner (`/plan`):** Guides users through setting weekly goals, displaying previous week's reports, and offering detailed customization for walk durations and diet tips. Includes specific review sections for dinner focus and diet struggles.
- **Reporting:** Displays weekly and monthly progress, completion rates, and diet tip tracking.
- **Developer Debug Panel (`/dev`):** Provides tools for authorized developers to inspect state, override time, set profile parameters, and generate historical data for testing.

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