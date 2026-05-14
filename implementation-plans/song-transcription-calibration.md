# Song Transcription Calibration

## Goal

Make song-mode vocal note transcription capture the real sung notes in `good_thing_song.mp3` with professional-looking note blocks, without letting sensitive detection flood the chart with noise.

## Approach

Compare the app's Basic Pitch post-processing against a known-good offline vocal transcription workflow on the provided MP3, identify where notes are lost or noise is admitted, then update the browser-local post-processing and UI presets while keeping interval practice and live Pitchy tracking untouched.

## Affected Areas

- `src/song/`
- `src/app/PitchCoachApp.test.tsx`
- `tests/browser/`
- `implementation-plans/`

## Checklist

- [x] Build a repeatable offline comparison for the provided MP3
- [x] Identify the current recall/noise failure points
- [x] Update transcription post-processing and presets
- [x] Add regression coverage for note recall, de-noising, and UI flow
- [x] Validate unit, build, lint, browser, and audio calibration checks
- [x] Commit and push the draft PR update
