---
name: Account-scoped presentation state
description: Prevent session-persistent UI presentation state from crossing between accounts in the same app tab or WebView.
---

Any session-backed state that records what a user has already seen must include a stable, opaque account discriminator.

**Why:** Session storage survives logout and login in the same tab or native WebView. Keys based only on feature-cycle identifiers can suppress or falsely replay another account's transitions.

**How to apply:** Include a non-PII account scope in presentation keys, or reliably clear every related key when the authenticated identity changes. Account resets should also establish a fresh scope when prior presentation history must be discarded.