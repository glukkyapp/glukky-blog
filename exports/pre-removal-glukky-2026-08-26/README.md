# Glukky pre-removal source archive

Created: 2026-08-26
Purpose: review and future reference before any approved removal. This archive was created while the application source remained unchanged.

The complete source snapshots are divided into:

- `candidate-source-snapshots/`: files containing code that may be removed or surgically edited.
- `protected-active-snapshots/`: active FoodSnap, HStix, glucose-pattern, report, and notification infrastructure that must remain.
- `historical-migration-references/`: historical migration context only. These migrations are not deletion targets.
- `REMOVAL-MANIFEST.md`: the detailed removal boundary and protected paths.
- `verification/`: source-state and archive checksums.

Because several files contain both old planner code and active FoodSnap code, candidate snapshots are complete before-change files rather than blindly extracted whole-file deletions. The manifest identifies the removable sections and the active sections that must not be touched.

No application source files were deleted or edited to create this archive.
