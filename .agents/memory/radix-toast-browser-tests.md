---
name: Radix toast browser tests
description: How to avoid double-counting one user-visible toast in browser tests.
---

Browser tests that observe notifications should count visible `li[role="status"]` toast items rather than every `role="status"` node.

**Why:** Radix creates a hidden live-region announcement in addition to the visual toast. A generic role-based observer therefore treats one user-facing notification as two events.

**How to apply:** When a test needs to prove a single notification outcome, scope its locator or mutation observer to the visible toast list item and leave the accessibility announcement intact.