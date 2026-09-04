---
name: Canvas state durability
description: Why canvas presentation changes need durable artifact state in addition to live board updates.
---

Do not treat a successful live canvas API update as the only implementation of a presentation fix. Pair it with durable artifact state so completion review and future workspace reloads can recover the intended frame configuration.

**Why:** Live board updates are external to the ordinary source diff. A change can look correct during the session yet be absent from reviewable project state.

**How to apply:** When changing an existing frame’s URL or presentation metadata, update the live board and preserve the resulting frame state as part of the artifact.