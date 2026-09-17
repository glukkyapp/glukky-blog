---
name: CJK mockup video capture
description: Prevent missing Chinese glyphs when recording localized mockup previews with headless Chromium.
---

Localized mockup video components must explicitly load a CJK-capable webfont in their scoped stylesheet. Before starting or replaying the captured animation, the recorder must await `document.fonts.ready`.

**Why:** The regular preview browser can display Traditional Chinese through its own fallback fonts while Playwright's video-recording Chromium renders the same text as missing-glyph boxes. A visually correct preview does not prove the exported recording has usable CJK typography.

**How to apply:** Use a scoped CJK webfont for Chinese mockups, wait for network idle and `document.fonts.ready`, then inspect extracted frames from the encoded video rather than relying only on the live iframe.