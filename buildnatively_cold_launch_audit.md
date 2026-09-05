# BuildNatively Cold-Launch Audit

Audit date: 2026-09-05  
Production: `https://glukky-sugar.replit.app/`  
Scope: investigation and recommendations only; no runtime code, BuildNatively setting, or deployment change

## Executive conclusion

The shipped BuildNatively wrapper follows the standard automatic **page-loaded** native Loading Screen behavior. It does not visibly dismiss at the inline `nativelyOnLoad()` timestamp, and Glukky does not call the manual `window.natively.hideLoadingScreen()` bridge.

This conclusion combines:

1. BuildNatively's current documentation, which describes automatic hiding “after the page is loaded” for the SDK loading-screen control and separately exposes an explicit manual hide call.
2. Inspection of pinned `natively@2.20.0`, which contains `showLoadingScreen` and `hideLoadingScreen` but does not define or call `nativelyOnLoad`.
3. Repository inspection, which found no call to `showLoadingScreen` or `hideLoadingScreen`.
4. A killed-state iPhone launch where the inline marker ran, React mounted 1.414 seconds later, Stage 1 finished another 16.906 seconds later, and the native layer revealed the completed language-selection page rather than either HTML/React loading surface.

The comment in `client/index.html` saying that BuildNatively dismisses its splash when the page calls `nativelyOnLoad()` is an unsupported historical assumption. This report documents the discrepancy without changing production behavior.

The network-sensitive launch delay is now isolated:

- `__stage1ReadyAt` waits only for four parallel image attempts totaling 4,996,108 bytes.
- Wi-Fi: cube → Stage 1 ready = 6,226 ms.
- Without Wi-Fi: cube → Stage 1 ready = 16,906 ms.
- Difference = 10,680 ms.
- The four image promises have no retry and no timeout; the slowest terminal load/error controls readiness.
- Nineteen other image preloads start in the same launch window and compete for bandwidth but are not awaited by Stage 1.
- The React cube has a separate fixed 14,000 ms minimum.

## 1. Sources and wrapper lifecycle

Authoritative sources:

- BuildNatively Loading Screen controls:  
  https://docs.buildnatively.com/guides/integration/loading-screen
- BuildNatively SDK setup and developer-defined `nativelyOnLoad` example:  
  https://docs.buildnatively.com/guides/integration/how-to-get-started
- Native Launch Screen → Loading Screen sequence:  
  https://docs.buildnatively.com/natively-platform/appearance/launch-screen
- Pinned package manifest:  
  https://cdn.jsdelivr.net/npm/natively@2.20.0/package.json
- Pinned SDK source:  
  https://raw.githubusercontent.com/buildnatively/js-sdk/2.20.0/src/classes/Natively.ts
- Exact pinned distributable:  
  https://cdn.jsdelivr.net/npm/natively@2.20.0/natively-frontend.min.js

Pinned SDK behavior:

- `showLoadingScreen(autoHide)` sends native method `loading_screen` with `show_loader: true` and the requested `auto_hide`.
- `hideLoadingScreen()` sends `loading_screen` with `show_loader: false`.
- The exact 20,545-byte uncompressed SDK has no `nativelyOnLoad` identifier.
- BuildNatively's setup guide uses `nativelyOnLoad` as a developer-provided callback attached to the SDK script's browser `onload`; it is not documented as the native cold-launch dismissal API.

Glukky behavior:

- Loads the Natively SDK asynchronously.
- Executes an inline script near the end of the body.
- Records `window.__bnLoadedAt`.
- Calls `nativelyOnLoad()` only if a function already exists.
- Installs a no-op if it does not exist.
- Does not call `window.natively.showLoadingScreen(...)`.
- Does not call `window.natively.hideLoadingScreen()`.

Practical conclusion:

- Standard automatic behavior: native screen hides after the wrapper considers the page loaded.
- Optional SDK behavior: `showLoadingScreen(true)` requests auto-hide after page load.
- Manual behavior: `hideLoadingScreen()` explicitly requests dismissal.
- Shipped Glukky behavior: automatic page-loaded path; no manual call.

## 2. Killed-state iPhone evidence

### First capture

| Marker | Value |
|---|---:|
| `__bnLoadedAt` | 1788621629867 ms |
| `__cubeMountedAt` | 1788621631281 ms |
| `__stage1ReadyAt` | 1788621648187 ms |
| Inline marker → cube | 1,414 ms |
| Cube → Stage 1 ready | 16,906 ms |
| First visible surface after native dismissal | Language-selection page |

If the inline call directly dismissed the native layer, the HTML loading surface should have appeared before React mounted. It did not. If React mount dismissed it, the cube should have appeared. It did not. The native layer remained until the app had advanced to the language-selection surface.

### Network comparison

| Network | BN → cube mounted | Cube → Stage 1 ready |
|---|---:|---:|
| Without Wi-Fi | 1,414 ms | 16,906 ms |
| Wi-Fi | 977 ms | 6,226 ms |
| Difference | +437 ms | **+10,680 ms** |

The major variable is inside Stage 1, not BN → React mount.

## 3. Reproducible production browser measurement

Method:

- Four independent fresh Chromium contexts.
- Service workers blocked.
- HTTP cache disabled.
- `Cache-Control: no-cache, no-store` and `Pragma: no-cache`.
- Navigation and Resource Timing captured at `load` and after a five-second settle.

All four navigations succeeded.

### Navigation timing

| Timing | Minimum | Median | Maximum |
|---|---:|---:|---:|
| DNS | 3.2 ms | 4.4 ms | 6.5 ms |
| Connect/TLS | 3.6 ms | 5.1 ms | 261.3 ms |
| TTFB | 21.4 ms | 24.0 ms | 137.2 ms |
| DOM interactive | 115.0 ms | 123.1 ms | 781.5 ms |
| DOMContentLoaded | 221.5 ms | 285.9 ms | 864.0 ms |
| Window `load` | 272.6 ms | 407.5 ms | 1,200.9 ms |

The preliminary approximately 2.88-second desktop run was not reproduced, but remains plausible under a different CDN edge, network, CPU, or autoscale state.

### Resource totals after five seconds

- 35 resource entries.
- 21,339,763 transfer bytes.
- 21,329,263 encoded-body bytes.
- 21,367,240 decoded-body bytes.
- Navigation HTML separately: 7,092 transfer bytes and 6,792 body bytes.

Resource scheduling relative to `load` varied:

- Two runs had 34 resources by `load`.
- Two runs had only six by `load`, followed by 29 requests and 19,631,446 transfer bytes.

The iPhone captures show that React-created images can remain inside the effective WebView page-load window even when desktop scheduling places them later.

### Largest and slowest production resources

| Type | Resource | Transfer / encoded / decoded | Duration |
|---|---|---:|---:|
| Initial JS | `assets/index-CZssPv44.js` | 1,472,566 / 1,472,266 / 1,472,266 B | 54–77 ms |
| Natively JS | `natively@2.20.0/natively-frontend.min.js` | 6,035 / 5,735 / 20,545 B | 124–144 ms |
| Landing chunk | `landing-B2VWxFoJ.js` | 15,169 / 14,869 / 14,869 B | 46–66 ms |
| Main CSS | `assets/index-BYX6IswO.css` | 104,620 / 104,320 / 104,320 B | 39–56 ms |
| Google Fonts CSS | Google Fonts stylesheet | 1,517 / 1,217 / 24,384 B | 29–46 ms |
| Loading font | `loading-label-zh-subset.woff2` | 1,924 / 1,624 / 1,624 B | 32–91 ms |
| Launch video | `launch/har-gow-launch.mp4` | 121,655 / 121,355 / 121,355 B | 31–44 ms |
| Auth API | `/api/auth/user` | 326 / 26 / 26 B | 29–40 ms |
| Largest image | `slide2_meal-248FhG33.png` | 1,854,142 / 1,853,842 / 1,853,842 B | 101–155 ms |
| Slow image | `generated-image_(13)_...png` | 1,331,634 / 1,331,334 / 1,331,334 B | 161–178 ms |

Totals:

- Six scripts: 1,501,121 transfer bytes.
- Main + Google CSS: 106,137 transfer bytes.
- Twenty-four images: 19,608,600 transfer bytes.
- Launch video: 121,655 transfer bytes.

## 4. Initial payload and module graph

Committed build payload inspected:

| Resource | Raw size |
|---|---:|
| HTML | 6,679 B |
| Initial JavaScript | 1,478,284 B |
| Initial CSS | 104,320 B |
| Loading-label font | 1,624 B |
| Launch MP4 | 121,355 B |
| **Total** | **1,712,262 B** |

The deployed and committed entry hashes differ, but both builds have an approximately 1.47–1.48 MB initial JS entry.

Eager imports include:

- React DOM and `App`.
- Global CSS.
- Wouter and TanStack Query.
- Authentication/query client.
- i18next, React i18next, and complete English locale.
- Toast, tooltip, dialog, input, button, navigation, and transition primitives.
- Consent, offline, and global loading providers.
- PostHog implementation.
- OneSignal identity implementation.
- RevenueCat/BuildNatively purchase wrapper.
- Cube, unlock, and paywall-exit overlays.
- Asset URL imports for all preload stages.

Lazy page routes:

- Landing, onboarding, home, profile, doctor information, FoodSnap, health information, app intro, dev panel, not found, report, food log, Hstix, glucose patterns, confidentiality, and password reset.

Locale policy:

- English is eager.
- Traditional Chinese and Cantonese are dynamic chunks of approximately 65 KB each.
- English fallback renders while a non-English chunk loads.

## 5. Exact Stage-1 blocker

`__stage1ReadyAt` is written after one `Promise.all` for four `Image` objects.

- Parallel start.
- Resolve on `load` or `error`.
- No retry.
- No timeout.
- Slowest terminal request controls readiness.

### Mandatory Stage-1 requests

| Production request | Size | Awaited | Retry/timeout | Wi-Fi | No Wi-Fi | Independent clean-browser duration |
|---|---:|---|---|---:|---:|---:|
| `/assets/generated-image_(5)_copy_1788506043742-BESsizhl.png` | 860,598 B | Yes | None / none | Per-image unavailable | Per-image unavailable | 268.1 ms |
| `/assets/slide1_walk-1ve992kA.png` | 943,820 B | Yes | None / none | Per-image unavailable | Per-image unavailable | 270.0 ms |
| `/assets/slide2_meal-248FhG33.png` | 1,853,842 B | Yes | None / none | Per-image unavailable | Per-image unavailable | 285.8 ms |
| `/assets/cyucyu_A_subtly_smiling_Asian_person_holding_a_smartphone_loo__1773936364915-CVxxV5yE.png` | 1,337,848 B | Yes | None / none | Per-image unavailable | Per-image unavailable | 282.3 ms |
| **Four-image gate** | **4,996,108 B** | **Yes** | Slowest request wins | **6,226 ms** | **16,906 ms** | 285.8 ms slowest |

All four returned HTTP/2 `200`, long-lived immutable cache headers, ETag, and Last-Modified. They were served by Google Frontend through the Glukky origin.

`slide1_walk` contains JPEG data despite its `.png` filename and `image/png` response header. It displayed in Chromium, but per-image iOS decode timing is not currently captured.

First-screen necessity:

- Brand mark: immediately visible/likely mandatory.
- Slide 1: immediately visible if the landing carousel opens on it.
- Slide 2: future carousel content; not mandatory for first frame.
- Slide 3: future carousel content; not mandatory for first frame.

## 6. Requests and initialization after cube mount

A clean logged-out production trace observed:

- Cube mount: approximately +596.2 ms.
- Six pig images start: +596.4–596.7 ms.
- Four Stage-1 images start: +596.7–596.9 ms.
- Landing chunks start: +629.8–630.7 ms.
- Thirteen Stage-2 images start: +832.0–832.7 ms.

### Mandatory first-screen work

| Work | Endpoint/service | Awaited/retried | Duration |
|---|---|---|---:|
| Authentication | `GET /api/auth/user`, Glukky | Separate `authReady` gate; `retry:false`; raw fetch has no explicit timeout | 29–40 ms desktop; iPhone unavailable |
| Four Stage-1 images | Glukky static assets | Awaited; no retry; no timeout | 6,226 ms Wi-Fi / 16,906 ms without Wi-Fi aggregate |
| Landing route | `/assets/landing-B2VWxFoJ.js` | Suspense waits; no app retry/timeout | 189.6 ms in clean trace |
| Landing dependency | `/assets/index-C4BlRpLl.js` | Module dependency | 94.0 ms |
| Landing dependency | `/assets/label-xFvvHF9G.js` | Module dependency | 128.7 ms |
| Landing dependency | `/assets/loader-circle-BOOy70y9.js` | Module dependency | 170.0 ms |
| Cube minimum | Local timer | Fixed 14,000 ms; no network | 14,000 ms |

Authentication does not control `__stage1ReadyAt`, but cube dismissal requires both auth and Stage-1 readiness.

### Concurrent but safely deferrable work

| Work | Endpoint/service | Awaited/retried | Clean duration |
|---|---|---|---:|
| Launch MP4 reuse | `/launch/har-gow-launch.mp4` | Browser-managed; not Stage-1 awaited | 215.0 ms |
| Pig images ×6 | `IMG_2062`, `IMG_0610`–`IMG_0614` static assets | Fire-and-forget; not Stage-1 awaited | 194.6–256.4 ms each |
| Stage-2 onboarding images ×13 | Generated onboarding static assets | Separate tracked promise; no retry/timeout; Landing does not await | 77.3–220.3 ms each |
| Favicon | `/favicon.png` | Browser-managed | 37.3 ms |
| Non-English locale | zh-Hant or yue dynamic chunk | Fire-and-forget; no retry/timeout; English fallback available | Not captured per iPhone condition |

Twenty-three image requests can therefore be active shortly after cube mount: four mandatory Stage 1, six pig images, and thirteen non-first-screen Stage 2 images.

### Initialization not active in this logged-out interval

| Initialization | Endpoint/service | Policy | Classification |
|---|---|---|---|
| Consent | `GET /api/user/consent` | No retry/explicit timeout | Logged-out provider does not request |
| Profile/gate/piggy prefetch | `/api/profile`, `/api/gate-status`, `/api/piggybank` | Fire-and-forget | Authenticated only |
| PostHog | `https://us.i.posthog.com` | Consent then idle callback, 4s deadline or 1.5s fallback | Not initialized on logged-out path |
| OneSignal association | Native bridge + registration API | Bounded bridge polling/callback and later retries | Authenticated path |
| RevenueCat login | Native bridge | 30s timeout | Authenticated/consented path |
| Profile/dev/gate queries | Glukky APIs | Query-driven | Authenticated path |
| Stage 3/4 images | Glukky static assets | Consumer-triggered | Later screens |

## 7. A/B/C classification

### A. Page-load/native-handoff blockers

- HTML.
- Approximately 1.47–1.48 MB initial module.
- Approximately 104 KB main CSS.
- Loading-label font and launch video preloads can add request contention.
- Current Landing route chunks when discovered before load completion.
- Four React-created Stage-1 images. Device evidence shows these remain inside the effective native page-loaded handoff.

Not blockers:

- Async Natively SDK.
- Asynchronously applied Google Fonts CSS.
- PostHog.
- Authenticated OneSignal/RevenueCat/profile work on logged-out launch.

### B. First-usable-screen delays

- Fixed 14-second cube minimum.
- Four Stage-1 image attempts.
- `/api/auth/user`.
- Landing chunk/dependencies.
- Authenticated profile readiness on returning-user path.
- Non-English locale chunk may delay final localized text but not fallback UI.

### C. Safely deferrable work

- Slides 2 and 3.
- Six pig images.
- Thirteen Stage-2 onboarding images until after first Landing frame.
- Stage 3 and Stage 4 assets.
- PostHog.
- OneSignal association/probing.
- RevenueCat login.
- Piggy, gate, and dev-check background queries.

## 8. Timeout and retry policies

Directly capable of a 10–17 second or longer delay:

1. Stage-1 image gate: no timeout and no retry; can wait indefinitely.
2. Cube policy: fixed 14,000 ms minimum.
3. `/api/auth/user`: no retry, no explicit timeout; can hold `authReady`.
4. Lazy route chunks: browser-managed; no application timeout/retry.

Long policies not active as Stage-1 blockers:

- Offline recovery: 0/1/2/4-second backoff with 2-second abort per probe, then reload.
- OneSignal identity: approximately 6-second bridge polling plus approximately 6-second callback bound in relevant identity paths.
- Apple Sign-In: 30-second native callback timeout after user action.
- RevenueCat login: 30-second bridge timeout.
- RevenueCat restore: approximately 8-second pending-login wait plus 10-second restore timeout.
- PostHog: 4-second idle deadline or 1.5-second fallback; background only.
- Consent: no timeout; only delays consent-dependent background integrations.

## 9. Ranked minimal-risk optimization plan

No recommendation has been implemented.

### 1. Make only immediately visible artwork mandatory

- Keep the brand mark and, if necessary, Slide 1 in Stage 1.
- Move Slides 2 and 3 out of the native/cube gate.
- Benefit: remove 2,247,870 bytes if brand + Slide 1 remain mandatory, or 3,191,690 bytes if only the brand mark remains.
- Risk: low if future slides finish before the user advances.
- Validate: native dismissal, first Landing paint, and immediate swipe behavior on Wi-Fi and cellular.

### 2. Prevent Stage 2 and pig artwork from competing with Stage 1

- Start nineteen non-first-screen image requests after first usability or during idle time.
- Benefit: more bandwidth/connections/decode capacity for mandatory assets.
- Risk: low; later surfaces may need placeholders.
- Validate: waterfall contains only mandatory images before dismissal; onboarding/pig assets are ready when normally reached.

### 3. Add an upper bound to launch-image waiting

- Add a conservative per-image or aggregate timeout while retaining load/error behavior.
- Benefit: one stalled request cannot hold the native layer indefinitely.
- Risk: low–medium; timed-out artwork may appear later.
- Validate: stalled image, packet loss, and offline launch must show a branded nonblank first screen.

### 4. Capture per-image iPhone timings

- Record start/load/error/elapsed for each Stage-1 image.
- Benefit: identifies the exact cellular straggler before image conversion work.
- Risk: very low; diagnostic only.
- Validate: at least five Wi-Fi and five cellular killed-state launches; compare median/p90.

### 5. Optimize the confirmed straggler

- Resize/re-encode only after per-image data identifies priority.
- The 1.85 MB Slide 2 PNG is the largest candidate; Slide 1 has a filename/content-type mismatch.
- Benefit: lower transfer and decode cost.
- Risk: low–medium visual quality/compatibility.
- Validate: visual comparison, bytes, decode timing, iOS display, Stage-1 p90.

### 6. Bound authentication separately

- Give `/api/auth/user` a launch-appropriate timeout/failure state.
- Benefit: prevents a separate indefinite `authReady` hold after assets are fixed.
- Risk: medium; must not misclassify a slow valid authenticated session.
- Validate: slow server, offline, expired session, and returning-user launches.

The first two items are lowest risk and highest confidence because they remove non-first-screen bytes and contention without changing authentication, routing, wrapper APIs, analytics, push, or payment behavior.

## 10. Device validation procedure

For any later optimization:

1. Force-quit the iPhone app before each trial.
2. Run at least five Wi-Fi and five cellular launches.
3. Capture:
   - app tap → native dismissal;
   - `__bnLoadedAt`;
   - `__cubeMountedAt`;
   - each Stage-1 image start/load/error if diagnostic timing is added;
   - `__stage1ReadyAt`;
   - first usable Landing screen.
4. Record browser `loadEventStart`/`loadEventEnd` through Safari Web Inspector where possible.
5. Compare median and p90.
6. Reject changes that introduce a blank frame, untranslated first screen, missing first slide, broken auth routing, or bridge initialization regression.

## Limitations

- Individual Stage-1 image timings are unavailable for the two iPhone captures, so the exact cellular straggler cannot be named from current instrumentation.
- Browser Resource Timing measures request completion, not all image decode/paint work.
- Desktop measurements use a different geography/network/engine path from the BuildNatively iOS WebView.
- One device sample per network establishes the large network sensitivity but not stable median/p90 performance.
- The exact native wrapper version and dashboard settings are not stored in the repository.