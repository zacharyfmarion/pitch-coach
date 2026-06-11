# Card System Mock Parity
## Goal
Unify mock-style cards behind the shared Card/StatCard primitives and make Progress use the same card and header hierarchy as the mocks.

## Approach
- Add mock card variants to the Card primitive and expose variant/class hooks through StatCard.
- Convert Home stat/mode/resume cards and Song mock surfaces to use Card/StatCard instead of raw card-like elements.
- Restyle Progress with the mock page header, shared stat card row, and mock Card variants.
- Remove the Progress eyebrow copy that does not appear in the mocks.

## Affected Areas
- `src/components/ui/Card.tsx`
- `src/components/ui/StatCard.tsx`
- `src/app/PitchCoachApp.tsx`
- `src/song/SongPracticeScreen.tsx`
- `src/styles/ui.css`
- `index.html`
- relevant tests

## Checklist
- [x] Add Card/StatCard variants for mock cards.
- [x] Convert Home and Song card-like surfaces to shared primitives.
- [x] Convert Progress summary and dashboard cards to mock variants.
- [x] Align Progress header/subhead copy with the mocks.
- [x] Validate and commit.
