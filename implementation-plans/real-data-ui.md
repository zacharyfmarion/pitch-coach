# Real Data UI

## Goal
Replace remaining mock/demo UI values with real local practice data and neutral local-device copy.

## Approach
Use the existing attempt history summaries as the source of truth for Home, Sidebar, and Practice Library metrics. Remove demo fallback stats and keep song history persistence as a later phase.

## Affected Areas
- Home screen stats, streak, recommendation card, and practice mode progress.
- Sidebar local save footer copy and streak.
- Practice Library header and exercise tile display.
- Weekly accuracy trend and tests that asserted mock data.

## Checklist
- [x] Wire sidebar and Home to real practice summary data.
- [x] Replace Practice Library demo totals/fallback exercise stats.
- [x] Generate trend/previews from real summaries or exercise metadata.
- [x] Update unit and browser tests.
- [x] Run validation and commit.
