---
name: Native splash handoff
description: Preserve visible fallback content between the BuildNatively splash and React's first paint.
---

The app shell must create visible, locale-aware fallback content before calling the native splash dismissal hook. React should replace that fallback automatically when it commits its first render; avoid persistent layout styles on the React root.

**Why:** Dismissing the native splash while the root is still empty can expose a blank WebView interval on real iPhones even when browser preview looks seamless.

**How to apply:** When changing boot scripts or shell markup, keep the dismissal call synchronous but place it after the fallback DOM exists. Keep the fallback system-font-based and safe-area/visual-viewport aware.