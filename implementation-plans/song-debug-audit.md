# Song Debug Audit

## Goal

Add a local-only song-mode debugging view that audits the notes currently drawn on the timeline without changing transcription, separation, scoring, or playback behavior.

## Approach

Expose the same viewport math used by the canvas, compute visible reference-note rows with both section-relative and original-song timestamps, and draw a vocal-stem energy strip under the timeline when debug mode is enabled.

## Affected Areas

- `src/song/`
- `src/app/PitchCoachApp.test.tsx`
- `src/styles.css`

## Checklist

- [x] Add pure diagnostics helpers for viewport, visible-note rows, and vocal energy
- [x] Add a song debug toggle, side-panel note audit, and timeline energy strip
- [x] Add unit and component coverage for the debug audit
- [x] Validate tests, build, lint, and browser flow
- [x] Commit and push the draft PR update
