# Group Progress By Sessions

## Goal
Render Progress recent activity as practice sessions instead of individual attempts.

## Approach
Add an explicit local practice session record, attach each attempt to the active exercise visit session, and aggregate recent progress rows from sessions plus attempts. Keep summary cards attempt-based for this pass.

## Affected Areas
- Domain progress aggregation and contracts.
- IndexedDB attempt history storage.
- Exercise controller session lifecycle.
- Progress UI and tests.

## Checklist
- [x] Add session records and aggregation helpers.
- [x] Persist sessions alongside attempt history.
- [x] Track active exercise visit sessions in the controller.
- [x] Render Progress rows and trend from sessions.
- [x] Update unit and browser tests.
- [x] Run validation and commit.
