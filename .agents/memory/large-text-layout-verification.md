---
name: Large-text layout verification
description: A visual verification rule for compact responsive components.
---

For compact responsive UI, verify sibling-to-sibling overlap as well as whether each element stays inside its parent.

**Why:** Parent-bound checks passed while a long neutral status badge still overlapped adjacent meal details at the smallest large-text viewport; the screenshot exposed the collision.

**How to apply:** At required viewport and text-size combinations, compare sibling bounding rectangles and inspect a rendered screenshot for long localized and fallback labels.