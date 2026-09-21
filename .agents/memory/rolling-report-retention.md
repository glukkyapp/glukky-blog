---
name: Rolling report retention
description: Privacy-preserving retention rule for the rolling two-month meal-pattern report.
---

The two-month report must read retained per-meal report facts rather than raw meal records, even when raw retention is longer than the report window. Facts retain only the local date, meal type, and final impact label—never meal images, food details, or HStix glucose values.

**Why:** Raw retention was extended to allow glucose-pattern evidence to accumulate, not to reverse the report's privacy-minimal architecture. Keeping the report independent of raw retention preserves correctness after eventual deletion and future retention-policy changes.

**How to apply:** Refresh the retained fact whenever a meal's impact or meal type can change, including linked HStix creation or correction. Persist the fact before any raw-meal purge and erase retained facts alongside full account deletion.