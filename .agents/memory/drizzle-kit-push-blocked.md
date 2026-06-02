---
name: drizzle-kit push blocks on apple_id constraint
description: drizzle-kit push hangs forever on an interactive TTY prompt about a pre-existing users_apple_id_unique constraint — use executeSql for new columns instead.
---

## Rule
Never rely on `npx drizzle-kit push` interactively in this project. It hangs on a TTY prompt asking whether to truncate the `users` table for the `users_apple_id_unique` constraint. No flag (`--force`, piped stdin) bypasses it.

**Why:** There is a pending `users_apple_id_unique` unique constraint in the schema that has not yet been applied to the DB. Every `drizzle-kit push` run hits this prompt and stalls.

**How to apply:** When adding new columns, apply them directly with `executeSql` (via the code_execution tool) using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`. Verify with an `information_schema.columns` query afterward.
