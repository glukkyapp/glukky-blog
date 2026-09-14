---
name: Reward popup mode timing
description: Why mode-aware reward notifications wait for a committed mode and how to preserve that guarantee.
---

Treat a point increase and its resolved reward mode as one presentation event. Do not render Garden wording while the mode is unresolved.

**Why:** The current non-optimistic flow commits the point award and first-point mode assignment together, then refetches both fields in one response. A future optimistic point update could otherwise expose a fresh balance with a null mode and silently show the wrong message.

**How to apply:** Any optimistic piggy-bank cache work must either publish balance and mode atomically or leave the popup pending until mode is non-null. Preserve regression coverage for a first-point photo assignment.