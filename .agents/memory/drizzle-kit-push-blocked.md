---
name: drizzle-kit push and apple_id constraint
description: drizzle-kit push encounters a pre-existing users_apple_id_unique prompt; ad hoc schema work should use executeSql, while post-merge sync needs noninteractive mode and enough time.
---

## Rule
Do not rely on an interactive `npx drizzle-kit push` in this project. It encounters a prompt asking whether to truncate the `users` table for the `users_apple_id_unique` constraint. For ad hoc schema changes, use direct SQL instead. If the post-merge setup retains a full schema sync, run it non-interactively with `--force` and allow at least two minutes.

**Why:** The pending constraint can make schema pulls exceed a short post-merge timeout; the setup must not wait indefinitely for closed stdin or a 20-second budget.

**How to apply:** When adding new columns, apply them directly with `executeSql` using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`, then verify via `information_schema.columns`. For automated post-merge setup, use the configured script's noninteractive force flag and a 120000 ms timeout.
