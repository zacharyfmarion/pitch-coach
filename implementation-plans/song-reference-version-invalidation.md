# Song Reference Version Invalidation

## Goal

Prevent stale song-note analyses from surviving local hot reloads after transcription changes, so the timeline cannot render outdated `reference.notes` against current vocal RMS diagnostics.

## Approach

Stamp newly generated song references with a transcription analysis version, treat missing or older versions as stale, and have the song controller clear stale references while preserving the separated vocal stem for a fast re-analysis.

## Affected Areas

- `src/song/`
- `src/app/PitchCoachApp.test.tsx`
- `implementation-plans/`

## Checklist

- [x] Add a current song-reference analysis version and helper
- [x] Stamp Basic Pitch references with the current version
- [x] Invalidate stale in-memory references in song mode
- [x] Add focused regression coverage
- [x] Validate tests, build, lint, and browser flow
