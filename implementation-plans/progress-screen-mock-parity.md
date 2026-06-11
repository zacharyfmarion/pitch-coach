# Progress Screen Mock Parity

## Goal
Match the Progress screen layout and styling to the provided mock while continuing to show real local practice history.

## Approach
Refactor the Progress route into dedicated metric, chart, week, and recent-session components. Scope the visual rules to the Progress page in `index.html` so it uses the same warm mock theme without disturbing the existing Home, Song, Practice Library, or exercise screens.

## Affected Areas
- `src/app/PitchCoachApp.tsx`
- `src/app/PitchCoachApp.test.tsx`
- `tests/browser/app.spec.ts`
- `index.html`

## Checklist
- [x] Replace the old Progress dashboard layout with mock-aligned components.
- [x] Add scoped Progress screen styling in the HTML file.
- [x] Update unit and browser expectations for the new labels and recent-session rows.
- [x] Run lint, unit tests, build, and browser tests.
- [x] Commit the completed phase.
