---
name: Development seed guards
description: How to distinguish intentionally destructive development seed execution from production in this workspace.
---

Require an explicit `NODE_ENV=development` (or `test` for isolated tests) before running destructive development seed/reset scripts. Do not use `REPLIT_ENVIRONMENT` as the deciding guard in this workspace.

**Why:** The interactive development workspace reported `REPLIT_ENVIRONMENT=production`, causing a valid development cleanup to be rejected. An explicit `NODE_ENV=production` refusal correctly stopped execution before any database query.

**How to apply:** Put the guard before account lookup or transaction creation, and require callers to opt in by setting `NODE_ENV` explicitly. Keep exact account identity checks and account-scoped SQL as independent safeguards.