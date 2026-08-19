---
name: Browser test auth origin
description: Same-origin and rate-limit constraints for authenticated Playwright browser tests.
---

Authenticated Playwright flows must use the exact same hostname for `context.request` setup and page navigation. Log in first, and register only when login confirms the account does not exist.

**Why:** Session cookies are host-scoped, so `127.0.0.1` API calls do not authenticate a page opened on `localhost`. Repeated registration attempts also consume the shared auth rate limit.

**How to apply:** Use the configured browser `baseURL` consistently for both API and page traffic. In reusable setup, try login first and fall back to one registration attempt only after an unauthorized response.