---
name: Launch media preload compatibility
description: Cross-browser constraints for preloading launch video and keeping a localized label visible.
---

Keep the launch `<video preload="auto">` in the initial HTML as the authoritative early request. A matching `as="video"` hint may help browsers that support it, but Chromium can reject that preload destination.

**Why:** Chromium reported `as="video"` as unsupported. Trying to suppress that warning with `media="(-webkit-touch-callout: none)"` disabled the hint because CSS properties are not valid media features.

**How to apply:** Do not gate resource hints with CSS-property syntax. Keep preload and runtime URLs byte-identical, and verify request counts rather than assuming a hint was consumed.

When a required font uses `font-display: block`, keep localized text on a visible system fallback until `document.fonts.load()` resolves, then apply the custom family.

**Why:** Applying a blocked face before it is ready can make first-paint text invisible on a cold cache.

**How to apply:** Preload the small subset, but only opt the visible label into that family after the Font Loading API confirms readiness.