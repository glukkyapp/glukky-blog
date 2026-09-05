# Exhaustive API Authentication Inventory

Every API route declaration found in `server/routes.ts` and `server/replit_integrations/auth/replitAuth.ts` is listed separately.

| Route | Method | Requires auth | How enforced | Personal-data risk flag |
|---|---:|---|---|---|
| `/api/build-info` | GET | No | Public | Low |
| `/api/user/glucose-guidance/:kind` | GET | Yes | `isAuthenticated` | High |
| `/api/user/glucose-guidance/:kind/seen` | POST | Yes | `isAuthenticated` | High |
| `/api/health` | GET | No | Public | Low |
| `/api/meal-suggestions` | GET | Yes | `isAuthenticated` | Medium: returns prior food names |
| `/api/admin/wipe-user` | POST | No session | `adminLimiter` + inline `x-admin-secret` | Critical |
| `/api/admin/enroll-pilot` | POST | No session | `adminLimiter` + inline `x-admin-secret` | High |
| `/api/auth/delete-account` | POST | Yes | `isAuthenticated` | Critical |
| `/api/user/data-export` | GET | Yes | `isAuthenticated` | Critical |
| `/api/user/pdf-export` | GET | Yes | `isAuthenticated` | Critical |
| `/api/user/correction-request` | POST | Yes | `isAuthenticated` | High |
| `/api/user/correction-requests` | GET | Yes | `isAuthenticated` | High |
| `/api/user/deletion-status` | GET | Yes | `isAuthenticated` | High |
| `/api/user/account/cancel` | DELETE | Yes | `isAuthenticated` | Critical |
| `/api/user/account/delete-immediately` | POST | Yes | `isAuthenticated` | Critical |
| `/api/profile` | POST | Yes | `isAuthenticated` | High |
| `/api/profile` | GET | Yes | `isAuthenticated` | High |
| `/api/user/glucose-patterns/swipe-tutorial` | GET | Yes | `isAuthenticated` | Medium |
| `/api/user/glucose-patterns/swipe-tutorial/seen` | POST | Yes | `isAuthenticated` | Medium |
| `/api/profile/health-markers` | PATCH | Yes | `isAuthenticated` | High |
| `/api/profile/doctor-info` | GET | Yes | `isAuthenticated` | Critical |
| `/api/profile/doctor-info` | PATCH | Yes | `isAuthenticated` | Critical |
| `/api/profile/name-goal` | PATCH | Yes | `isAuthenticated` | High |
| `/api/profile/language` | PATCH | Yes | `isAuthenticated` | Medium |
| `/api/profile/font-size` | PATCH | Yes | `isAuthenticated` | Low |
| `/api/profile/intro-seen` | PATCH | Yes | `isAuthenticated` | Low |
| `/api/piggybank` | GET | Yes | `isAuthenticated` | Medium |
| `/api/piggybank/reward` | POST | Yes | `isAuthenticated` | Medium |
| `/api/piggybank/claim` | POST | Yes | `isAuthenticated` | Medium |
| `/api/profile/hard-lock` | POST | Yes | `isAuthenticated` | Medium |
| `/api/onesignal/register` | POST | Yes | `isAuthenticated` | High |
| `/api/uptime/ping` | GET | No | Public | Low |
| `/api/onesignal/external-id` | POST | Yes | `isAuthenticated` | High |
| `/api/dev/glucose-patterns/swipe-tutorial/reset` | POST | Yes | `isAuthenticated` | Medium |
| `/api/dev/test-notification` | POST | Yes | `isAuthenticated` + `isDevUser` | High |
| `/api/dev/onesignal-bridge-probe` | POST | Yes | `isAuthenticated` + `isDevUser` | High |
| `/api/dev/onesignal-status` | GET | Yes | `isAuthenticated` + `isDevUser` | High |
| `/api/dev/check` | GET | Yes | `isAuthenticated` | High |
| `/api/dev/reset-account` | POST | Yes | `isAuthenticated` + `isDevUser` | Critical |
| `/api/user/consent` | GET | Yes | `isAuthenticated` | Critical |
| `/api/user/consent` | POST | Yes | `isAuthenticated` | Critical |
| `/api/snap/label` | POST | Yes | `isAuthenticated` + `aiSnapLimiter` | High |
| `/api/snap/disambiguate` | POST | Yes | `isAuthenticated` + `aiSnapLimiter` | High |
| `/api/snap/advice` | POST | Yes | `isAuthenticated` + `aiSnapLimiter` | Critical |
| `/api/snap/:snapId/meal-type` | PATCH | Yes | `isAuthenticated` + owner-scoped storage | High |
| `/api/snap/daily-summary` | GET | Yes | `isAuthenticated` | High |
| `/api/snap/food-frequency` | GET | Yes | `isAuthenticated` | High |
| `/api/snap/two-month-summary` | GET | Yes | `isAuthenticated` | Critical |
| `/api/snap/weekly-summary` | GET | Yes | `isAuthenticated` | High |
| `/api/snap/monthly-summary` | GET | Yes | `isAuthenticated` | Critical |
| `/api/snap/meal-log` | GET | Yes | `isAuthenticated` | Critical |
| `/api/snap/post-meal` | POST | Yes | `isAuthenticated` + owner lookup | Critical |
| `/api/hstix/readings` | GET | Yes | `isAuthenticated` | Critical |
| `/api/hstix/readings` | POST | Yes | `isAuthenticated` + owner lookup | Critical |
| `/api/hstix/readings/:id` | PATCH | Yes | `isAuthenticated` + owner-scoped update | Critical |
| `/api/snap/:id/dismiss-overlap` | PATCH | Yes | `isAuthenticated` + owner-scoped update | High |
| `/api/user/glucose-thresholds` | GET | Yes | `isAuthenticated` | Critical |
| `/api/user/glucose-personalised-seen` | POST | Yes | `isAuthenticated` | High |
| `/api/snap/glucose-patterns` | GET | Yes | `isAuthenticated` | Critical |
| `/api/snap/monthly-symptoms` | GET | Yes | `isAuthenticated` | High |
| `/api/gate-status` | GET | Yes | `isAuthenticated` | High |
| `/api/diag/restore-trace` | POST | Yes | `isAuthenticated` | High |
| `/api/update-premium-status` | POST | Yes | `isAuthenticated` | High |
| `/api/refresh-premium-status` | POST | Yes | `isAuthenticated` | High |
| `/api/revenuecat/webhook` | POST | No session | Inline RevenueCat webhook authentication | High |
| `/api/health-data/:recordType/:recordId/history` | GET | Yes | `isAuthenticated` + base-record owner check | Critical |
| `/api/auth/password-reset/request` | POST | No | IP/account limiters; generic response | Critical |
| `/api/auth/password-reset/confirm` | POST | No | IP/token limiters + token transaction | Critical |
| `/api/auth/register` | POST | No | `authLimiter` + input validation | Critical |
| `/api/auth/login` | POST | No | `authLimiter` + credential validation | Critical |
| `/api/auth/apple-signin` | POST | No prior session | `authLimiter` + Apple verification or unsafe fallback | Critical |
| `/api/auth/logout` | POST | No | Inline session destruction | Medium |
| `/api/auth/user` | GET | Yes | `isAuthenticated` | High |

## Result

No personal-data route lacks authentication or equivalent admin/webhook authorization. The critical exception is not a missing middleware check but the unverified Apple subject fallback in `/api/auth/apple-signin`.