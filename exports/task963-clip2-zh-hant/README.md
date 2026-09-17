# Glukky Clip 2 — Traditional Chinese

This export is a deterministic UI recording of the real Foodsnap → Glucose Pattern flow. It is built as a standalone marketing mockup so no production application files, shared tokens, or app surfaces are recolored.

## Outputs

- `glukky-clip2-zh-hant.mp4` — H.264, 720×1280, 30 fps, 9:16
- `glukky-clip2-zh-hant.webm` — VP9, 720×1280, 30 fps, 9:16
- `raw/glukky-clip2-zh-hant-raw.webm` — original Playwright recording

Final verification:

| File | Size | SHA-256 |
| --- | ---: | --- |
| `glukky-clip2-zh-hant.mp4` | 1,190,463 bytes | `5b776ce3e0cba39d7b7d4461b347c58b40fc9193514460850f700be54a3200f0` |
| `glukky-clip2-zh-hant.webm` | 767,318 bytes | `3282ecb87a0660c9e958bef0d2cfc9c4bda5ebef1b68df21ca18dc0e0fec65f9` |

Both files are 12.03 seconds. The recorder removes UUID-named intermediate captures after saving `raw/glukky-clip2-zh-hant-raw.webm`, which is the sole canonical raw recording.

## Source and flow fidelity

- Foodsnap entry, Camera/Album selection, meal type, Continue, and analysing state follow `client/src/pages/snap.tsx`.
- Glucose Pattern hierarchy and measured-card content follow `client/src/pages/glucose-patterns.tsx`.
- The five-item floating navigation follows `client/src/components/floating-nav-bar.tsx`, including item order, `rgba(174,209,214,0.85)` background, 160px radius, and shadow.
- The higher-impact card uses the supported 白飯 fixture in `tests/glucose-pattern-ranked-cards.spec.ts`: 25 meals and 19 high readings.
- The comparison uses the validated 白飯 fixture in `tests/glucose-pattern-partners.test.mts`: 燒肉 as the higher-reading partner and 雞肉 as the lower-reading partner.
- The selected meal image is `attached_assets/generated_images/task963-white-rice-meal.png`.

## Verified Traditional Chinese copy

The UI copy comes from `client/src/locales/zh-Hant.json`, including:

- `snap.heading`
- `snap.subtitle`
- `snap.take_photo_camera`
- `snap.upload_from_album`
- `snap.meal_select_heading`
- `snap.meal_type_breakfast`
- `snap.meal_type_lunch`
- `snap.meal_type_dinner`
- `snap.meal_type_snack`
- `snap.meal_select_continue`
- `snap.analysing`
- `glucose.patterns_heading`
- `glucose.patterns_intro`
- `glucose.pattern_mode_hstix`
- `glucose.pattern_actual_heading`
- `glucose.pattern_hstix_reading`
- `glucose.pattern_hstix_result`
- `glucose.pattern_measured_impact_low`
- `glucose.pattern_hstix_description_low`
- `glucose.pattern_partner_comparison`
- `glucose.pattern_partner_disclaimer`

The pairing disclaimer appears whenever the pairing comparison is visible:

> 這只是你記錄中的模式，不能證明是其中一種食物造成差異。份量、其他食物、活動和測量時間也會影響讀數。

## Presentation treatment

The mockup’s outer/page presentation layer is `#FCFAF5`. In-app cards, buttons, badges, filters, and navigation keep their own faithful colors. Production app styling is unchanged.

## Reproduce

From the project root:

```sh
node exports/task963-clip2-zh-hant/source/record.mjs
```

The recorder waits for the bundled CJK font before starting animation, records a 720×1280 browser viewport, and exports MP4 and WebM with FFmpeg.