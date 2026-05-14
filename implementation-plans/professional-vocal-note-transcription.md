# Professional Vocal Note Transcription

## Goal

Replace the uploaded-song vocal reference extractor with browser-local Basic Pitch note transcription so song mode catches more real vocal notes while preserving local-only audio handling.

## Approach

Keep Pitchy for interval practice and live mic capture, but route separated song vocals through a lazy-loaded Basic Pitch transcription service. Store clean note events plus pitch-bend contour points, render note blocks in the song timeline, and score live singing against the interpolated note contour.

## Affected Areas

- `src/song/`
- `src/app/PitchCoachApp.test.tsx`
- `package.json`
- `pnpm-lock.yaml`

## Checklist

- [x] Add Basic Pitch transcription services and reference types
- [x] Replace song analysis and scoring with note/bend references
- [x] Add reference detail controls and quality readout
- [x] Replace old Pitchy stem-extraction tests with transcription/scoring coverage
- [x] Validate unit, build, lint, and browser coverage
- [x] Push updates to the draft PR
