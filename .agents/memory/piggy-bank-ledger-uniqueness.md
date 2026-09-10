---
name: Piggy-bank ledger uniqueness
description: Why current award idempotency uses a partial unique index instead of deduplicating historical ledger rows.
---

Enforce per-user uniqueness only for current namespaced piggy-bank award keys: `snap_`, `hstix_`, and `daily_win_`. Preserve older, non-namespaced ledger rows even when historical achievement labels repeat.

**Why:** Publish computes a schema diff and does not run data-cleanup statements from migration files before creating indexes. Production can contain legitimate legacy repeats, so a full-table unique index fails validation and deleting history is unnecessary.

**How to apply:** New award sources must use an explicit namespace and be added to the partial-index predicate. Keep insert conflict handling compatible with partial-index inference; an untargeted `ON CONFLICT DO NOTHING` avoids ORM predicate-matching issues.