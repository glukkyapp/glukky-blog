---
name: Canvas state durability
description: Why canvas presentation changes need durable artifact state in addition to live board updates.
---

Do not treat a successful live canvas API update as the only implementation of a presentation fix. Pair it with durable artifact state so completion review and future workspace reloads can recover the intended frame configuration.

**Why:** Live board updates are external to the ordinary source diff. A change can look correct during the session yet be absent from reviewable project state.

Before diagnosing colored gutters around an iframe as a stale preview or CSS problem, check the canvas geometry for another iframe occupying nearly the same coordinates. A slightly offset underlying frame can appear as narrow colored side panels.

**How to apply:** Inspect overlaps among canvas shapes first. When changing frame placement, update the live board and preserve the resulting frame state as part of the artifact.