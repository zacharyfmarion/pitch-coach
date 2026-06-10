# Song Tab Mock Shell
## Goal
Make the Song tab use the mock-aligned sidebar shell and warm visual system, with the upload/workbench styled like the Sing card from the mocks while preserving the existing local song practice flow.

## Approach
- Render the `/songs` route inside `MainShell` so the sidebar stays visible and the Sing tab is active.
- Refactor `SongPracticeScreen` from a standalone app shell into a mock-styled route surface that can live inside the shared shell.
- Keep the existing song controller, upload, analysis, debug, and practice controls functional.
- Add song-specific mock styles in `index.html`, alongside the Home/sidebar mock CSS.
- Update unit and browser tests that currently expect Song mode to be standalone.

## Affected Areas
- `index.html`
- `src/app/PitchCoachApp.tsx`
- `src/song/SongPracticeScreen.tsx`
- `src/app/PitchCoachApp.test.tsx`
- `tests/browser/app.spec.ts`

## Checklist
- [x] Route Song tab through the shared sidebar shell.
- [x] Restyle song upload/workbench to match the mock visual system.
- [x] Keep the empty Song tab limited to the mock upload/how-it-works state until a file is selected.
- [x] Show the mock processing card after a song is selected, before exposing practice controls.
- [x] Preserve upload, analysis, practice, feedback, and unsupported browser behavior.
- [x] Update focused React and browser tests.
- [x] Validate locally and visually inspect.
