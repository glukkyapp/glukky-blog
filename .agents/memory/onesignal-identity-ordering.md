---
name: OneSignal identity ordering
description: Safety rule for recovering from timed-out native login/logout identity commands.
---

Treat OneSignal identity changes as an ordered native operation queue. If a set or remove callback times out, retain the pending identity and block any new association until a later compensating remove confirms.

**Why:** A JavaScript timeout does not cancel a native command. OneSignal persists and retries identity operations in invocation order, so a later remove safely follows an earlier unresolved set; allowing a new association before that remove confirms can expose another account's pushes.

**How to apply:** Route every device identity set/remove through one client queue. On timeout, preserve durable pending state, enqueue removal before any future association, and never clear association caches until removal confirms.