---
name: Meal-impact refresh policy
description: Agreed freshness behavior for Daily and Food Log final-impact assessments.
---

Daily and Food Log intentionally refresh stale final-impact data on mount, focus, and reconnect, with a fifteen-minute stale window, rather than polling.

**Why:** Personalized thresholds can change overnight, but continuous polling was explicitly outside the approved repair scope. An already-focused screen is not promised immediate updates after the nightly job.

**How to apply:** Preserve this event-driven freshness contract unless a later request explicitly changes it. Do not claim an always-live threshold update or introduce polling as incidental cleanup.