---
name: Multi-stage AI trust boundaries
description: Security review rule for routes that invoke more than one model stage and persist downstream output.
---

Treat every model call in a multi-stage route as its own trust boundary, including translation, normalization, enrichment, and retry calls that run after the user-visible generation step. Apply untrusted-data isolation and strict output validation before any downstream result reaches shared persistence.

**Why:** A prompt-hardening change covered the visible FoodSnap label and advice calls but initially missed a downstream translation call whose output could update shared labels.

**How to apply:** When changing AI-input handling, inventory all model invocations reachable from the route, trace user/model-derived values into each request, and inspect every storage operation fed by each response.