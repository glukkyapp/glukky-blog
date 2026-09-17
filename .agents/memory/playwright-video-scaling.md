---
name: Playwright video scaling
description: Ensure deterministic browser recordings fill their requested video frame instead of occupying only part of it.
---

Set the browser viewport to the final encoded frame dimensions. If the mockup is authored at a smaller logical size, scale its root stage with CSS and use the final-size viewport for recording.

**Why:** Playwright's `recordVideo.size` sets the encoded frame dimensions but does not reliably upscale a smaller page viewport. A smaller viewport can appear unscaled in one corner with unused space filling the rest of the frame.

**How to apply:** For a 720×1280 export, use a 720×1280 viewport. A 360×640 logical mockup may be rendered with a 2× root transform, but do not depend on `recordVideo.size` to perform that scaling.