---
name: BuildNatively loading lifecycle
description: How to distinguish documented native loading-screen controls from the nativelyOnLoad callback convention.
---

Do not assume `nativelyOnLoad` dismisses BuildNatively's dashboard-configured native Loading Screen. The public SDK documents `showLoadingScreen(true)` for page-load auto-hide and `hideLoadingScreen()` for explicit dismissal; the pinned SDK does not define `nativelyOnLoad`. A killed-state device launch showed the native layer remaining past the inline marker and React loading surface, then revealing the completed language-selection page.

**Why:** BuildNatively's setup guide uses `nativelyOnLoad` as a developer-defined external-script load callback. Device event ordering corroborates the documented automatic page-loaded behavior and rejects the inline marker as the visible native handoff.

**How to apply:** Measure native dismissal, browser `window.load`, inline HTML execution, React mount, startup image completion, and first usability separately. React-created image requests can remain inside the WebView's load window and prolong the native layer.