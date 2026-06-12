# Interval Card Mock Parity
## Goal
Refactor the Home screen Interval Training card so it matches the latest screenshot mock treatment while preserving real local practice data and navigation behavior.
## Approach
- Use the latest user-provided screenshot as the visual target because the exact "Recently practiced" card is not present in the checked mock bundle.
- Rebuild the interval card at the original Home tile size with recent-practice rows, compact per-row score bars, and the footer `done / total` progress bar.
- Keep recent rows backed by local exercise progress where available, with starter rows only as visual placeholders before the user has history.
- Add focused style adjustments in the existing Home mock CSS area without changing unrelated app shell behavior.
- Update tests that assert the Home interval card content.
## Affected Areas
- `src/app/PitchCoachApp.tsx`
- `index.html`
- `src/app/PitchCoachApp.test.tsx`
- browser coverage if existing assertions depend on the card text
## Checklist
- [x] Confirm mock and current card structure.
- [x] Implement interval card markup and real-data display helpers.
- [x] Add mock-matched styles and responsive behavior.
- [x] Update focused tests.
- [x] Run deterministic validation and visual inspection.
- [x] Commit, push, and update the draft PR.
