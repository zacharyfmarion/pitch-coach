# Exercise Screen Mock Parity
## Goal
Refactor the focused exercise practice screen so it matches the latest exercise mocks while preserving the real local prompt, microphone, scoring, settings, and history behavior.

## Approach
- Replace the current two-column exercise detail view with the mock layout: compact header, top-bar Key/Strictness/Tempo controls, Auto/Manual segmented mode, coach bubble, note checkpoints, large pitch roll, and contextual transport.
- Map strictness to existing `toleranceCents`, tempo to existing `tempoBpm`, and key controls to the current root/lesson state without uploading or faking audio.
- Restyle the pitch timeline and checkpoints to match the mock's warm card, blue target lanes, note labels, and score readout.
- Keep the focused exercise screen scoped to the mock's practice surface, with secondary range/history surfaces kept outside the bottom of the exercise view.
- Update tests for the new visible controls and run deterministic validation.

## Affected Areas
- `src/app/PitchCoachApp.tsx`
- `src/app/usePitchCoachController.ts`
- `src/components/PitchTimeline.tsx`
- `src/styles/app.css`
- `src/styles/theme.css`
- `src/app/PitchCoachApp.test.tsx`
- `tests/browser/app.spec.ts`

## Checklist
- [x] Extract mock exercise screen structure and map it to real controller state.
- [x] Add controller support for key/root changes if needed.
- [x] Implement the mock-aligned exercise screen and controls.
- [x] Restyle the pitch timeline and responsive exercise layout.
- [x] Update tests for the redesigned exercise flow.
- [x] Run local validation and open a draft PR.
- [x] Align the tempo popover and top/bottom transport controls with the interactive exercise mock.
- [x] Validate the refined transport behavior and update the draft PR branch.
- [x] Make auto mode replay failed attempts and continue on the same target.
- [x] Validate the auto retry flow and update the draft PR branch.
- [x] Animate guide playback with active targets and a timeline playhead.
- [x] Wire the bottom ready control and Space key to auto play/pause.
- [x] Validate the guide playback interaction and update the draft PR branch.
- [x] Fix scored checkpoint icons to match the mock stones.
- [x] Validate the checkpoint icon rendering and update the draft PR branch.
- [x] Match score readout copy and remove the boxed background.
- [x] Validate the score readout styling and update the draft PR branch.
- [x] Match the bottom-right retry button to the icon-only mock control.
- [x] Validate the retry action and checkpoint marker styling, then update the draft PR branch.
- [x] Center checkpoint marker circles vertically in their note cards.
- [x] Keep guide-playback checkpoint markers dashed with active-note animation.
- [x] Remove the inner timeline frame border and tighten target strip spacing.
- [x] Remove the canvas-drawn plot border, lower detail cards, and visible restart status copy.
- [x] Validate the final mock cleanup and update the draft PR branch.
- [x] Resize the tempo popover to match the Key and Strictness setting popovers.
- [x] Validate the tempo popover polish, update the draft PR branch, and start a local dev server.
- [x] Match the refresh button's elevated mock background color.
- [x] Restore the rounded timeline frame border while keeping the canvas plot border removed.
- [x] Tune the note checkpoint strip margins to match the mock spacing.
- [x] Align guide playback visuals with chord-then-sequence prompt timing.
