# Song Reference Range

## Goal

Stop song-mode transcription from dropping uploaded-song vocal notes just because the interval-practice range is set narrowly.

## Approach

Use a song-specific reference analysis range that is at least `C3-C5`, expanded only when the user's configured range is broader, keep live song pitch detection bounded by the detected reference notes instead of the interval exercise range, and bump the song-reference version so older narrow-range analyses are invalidated.

## Affected Areas

- `src/song/`
- `src/app/PitchCoachApp.test.tsx`
- `implementation-plans/`

## Checklist

- [x] Add song-specific reference range helpers
- [x] Use the song reference range for Basic Pitch transcription
- [x] Use detected reference notes for song-practice mic bounds
- [x] Surface the reference range in song analysis/debug UI
- [x] Add regression coverage
- [x] Validate tests, build, lint, and browser flow
