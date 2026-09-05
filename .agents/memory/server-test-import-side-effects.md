---
name: Server test import side effects
description: Why focused backend tests should avoid broad production singleton imports.
---

Focused database-backed tests should import narrow, side-effect-free data-access modules rather than broad server storage or notification singletons.

**Why:** Some server utility import chains reach the application entrypoint and start migrations, listeners, and schedulers. A test that only intends to call storage can unexpectedly boot the whole app and collide with the development server.

**How to apply:** When adding backend integration tests, keep the production query in a focused module shared by the storage facade and the test. Avoid importing modules whose dependencies include logging from the server entrypoint.