---
name: Floating navigation width
description: Approved responsive width behavior for the shared bottom navigation.
---

Keep the shared bottom navigation centered and floating with its existing responsive width envelope: viewport width minus 32px, capped at 384px. Do not replace this with a fixed 296px width.

**Why:** Side-by-side review showed that both approaches fit on small phones, but the fixed compact width became noticeably undersized on large phones and gave large text less breathing room.

**How to apply:** Preserve the responsive width envelope when restyling the navigation. Derive height from icons, labels, padding, safe-area spacing, and 48–56px touch targets rather than preserving an old fixed height.