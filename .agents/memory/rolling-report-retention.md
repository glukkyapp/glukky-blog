---
name: Rolling report retention
description: Privacy-preserving retention rule for the rolling two-month meal-pattern report.
---

The two-month report must read retained per-meal report facts rather than raw meal records, which are intentionally deleted after 30 days. Facts retain only the local date, meal type, and final impact label—never meal images, food details, or HStix glucose values.

**Why:** A rolling two-completed-month window necessarily exceeds raw meal retention. Keeping the minimal dimensions preserves report correctness without weakening the product's raw health-data deletion policy.

**How to apply:** Refresh the retained fact whenever a meal's impact or meal type can change, including linked HStix creation or correction. Persist the fact before any raw-meal purge and erase retained facts alongside full account deletion.