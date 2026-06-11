# Vocal Range Onboarding Flow
## Goal
Implement the vocal range onboarding flow from the mocks with production behavior and pixel-parity styling.

The production flow should use the refined range setup modal from `Pitch Coach Range Setup.html` as the visual target, while preserving the product rule from `Pitch Coach Onboarding.html`: it appears the first time a user starts an exercise, not on app launch, and it never permanently blocks practice. Users can set a range manually, find it by singing, skip for now, reopen after skipping, save, tweak, and then continue into the originally requested drill.

## Approach
1. Model range onboarding as first-class local state.
   - Extend `CoachSettings` with an onboarding field rather than inferring completion from the default `C3-C5` range.
   - Proposed shape:
     ```ts
     export type VocalRangeSetupStatus = "unseen" | "skipped" | "completed";
     export type VocalRangeSetupSource = "default" | "manual" | "sing";
     export type VocalRangeSetup = {
       status: VocalRangeSetupStatus;
       source: VocalRangeSetupSource;
       completedAt?: string;
       skippedAt?: string;
       lastPromptedAt?: string;
     };
     ```
   - Add `rangeSetup` to `CoachSettings`, defaulting to `{ status: "unseen", source: "default" }`.
   - Normalize legacy saved settings so existing users keep their current range and see onboarding only if product wants first-run behavior for all legacy installs. Preferred product default: legacy settings without `rangeSetup` normalize to `unseen` only when the stored range is still exactly the default; otherwise normalize to `completed/manual`.
   - Keep `range` as the source of truth for scoring, root sequence generation, and detector bounds. `rangeSetup` only controls prompting and product copy.

2. Add pure range setup helpers in `src/domain`.
   - Create `src/domain/vocalRange.ts` for UI-independent range setup constants and helpers:
     - `VOCAL_RANGE_MIN_MIDI = parseNoteName("C2")`
     - `VOCAL_RANGE_MAX_MIDI = parseNoteName("C6")`
     - `VOICE_TYPE_PRESETS`: Bass `E2-E4`, Baritone `G2-G4`, Tenor `C3-C5`, Alto `F3-F5`, Mezzo `A3-A5`, Soprano `C4-C6`
     - `guessVoiceType(lowestMidi, highestMidi)`
     - `formatOctaveSpan(lowestMidi, highestMidi)`
     - `normalizeSetupRange(range)` with C2-C6 bounds and a minimum interval of one semitone for UI handles.
   - Leave the existing `normalizeRange` minimum-fifth behavior in `src/domain/exercise.ts` for scoring safety unless product decides the UI should enforce the same fifth minimum. The modal mock allows adjacent endpoints; production can allow one semitone in the editor and let settings normalization widen only impossible scoring ranges, or enforce a fifth in the UI for consistency. Preferred implementation: enforce at least a fifth in the save action to match current lesson behavior and avoid surprising post-save widening.

3. Add a small range capture service surface.
   - Reuse `AudioInputEngine` and `PitchDetectorAdapter`; do not add new microphone transport or any network calls.
   - Add controller-level range capture methods rather than embedding audio logic in components:
     - `startRangeCapture(target: "low" | "high")`
     - `stopRangeCapture()`
     - expose `rangeCaptureState` with `status`, `target`, `latestMidi`, `capturedMidi`, `errorMessage`.
   - Use broad C2-C6 detection bounds during setup, independent of the current exercise range.
   - Capture stable voiced frames locally and choose:
     - low note: lowest stable rounded MIDI after a short warmup window
     - high note: highest stable rounded MIDI after a short warmup window
   - Keep the mock's animated glide only as a reduced-risk fallback for tests/stories if needed; production singing mode should reflect live pitch frames.
   - Stop any active lesson attempt before starting onboarding capture and cleanly stop capture on modal close, skip, route changes, or save.

4. Gate exercise start through onboarding.
   - In `ExercisePracticeApp.openExercise`, preserve current behavior: selecting a drill routes to its focused exercise screen.
   - On the focused exercise screen, gate the primary "Start lesson" action:
     - If `settings.rangeSetup.status === "completed"`, start the lesson normally.
     - If `status === "unseen"`, open the range setup modal over the exercise screen with the originally requested start action queued.
     - If `status === "skipped"`, allow normal starts but show the skipped recovery banner or an "Edit range" affordance until completed.
   - When the user saves from the modal, persist `settings.range`, mark `rangeSetup.completed`, close the modal, and start the queued drill.
   - When the user skips, persist `rangeSetup.skipped`, keep the default/current range, close the modal, and start the queued drill.
   - Keep "Change anytime" true by replacing the current side-panel Low/High dropdowns with an "Edit range" control that reopens the same modal in edit mode.

5. Build the modal and visual primitives to match the mock.
   - Add `src/components/range/RangeSetupModal.tsx` as the orchestration component.
   - Add focused visual pieces under `src/components/range/`:
     - `RangeKeyboard.tsx`: horizontal keyboard with coral range band, draggable Low/High flags, tap-to-nearest-end behavior, live sing needle, octave labels, and pointer capture.
     - `NoteStepper.tsx`: low/high note steppers matching the mock's 34px controls and 44px note display.
     - `VoiceTypePresetList.tsx`: preset chips with selected state.
     - `SingCaptureProgress.tsx`: two-step low/high progress row.
     - `RangeSummary.tsx`: `C3-C5 · 2.0 oct · Tenor` footer chip.
     - `RangeSavedView.tsx`: saved confirmation with check pulse, span, voice type, "Start practicing", and "Tweak range".
     - `RangeSetupToast.tsx`: skipped/default-range recovery banner and saved/edit toast.
   - Use Radix Dialog via a small app UI primitive if needed. The repo already has AlertDialog but not Dialog; add `@radix-ui/react-dialog` only if it is not directly importable through existing dependencies. If avoiding a new dependency, implement a tightly scoped accessible modal with portal, focus return, Escape close, and `aria-modal`.
   - Use existing lucide icons: `Target`, `Mic`, `Play`, `Check`, `Settings`, `X`, `Plus`, `Minus`, `Volume2` where applicable.
   - Add a tiny reference-tone helper using Web Audio for the manual mode play buttons. Keep this local and user-gesture-driven.

6. Match the mock styling carefully.
   - Port dimensions and tokens from `rangesetup-modal.jsx` and `rangesetup-kbd.jsx` into CSS classes rather than inline styles:
     - modal width `620px`, saved width `560px`
     - radius `22px` for modal card
     - overlay `rgba(44,32,22,0.42)` with `blur(2px)`
     - card shadow `0 40px 100px rgba(40,25,12,0.34)`
     - keyboard surface `#fffdf9`, key black `#43372d`, accent `#ee6c4d`
     - header padding `24px 26px 0`, footer `14px 26px 22px`
     - segmented toggle: 4px gap/padding, 13px radius, selected white card with subtle shadow
   - Reuse existing app fonts and warm theme variables (`--font-display`, `--font-ui`, `--font-mono`, `--accent-primary`) so it blends with the current redesign.
   - Add responsive behavior: modal max-width `calc(100vw - 32px)`, keyboard scales to container width, footer stacks below about 680px, no clipped text or overlapping flags.
   - Add `prefers-reduced-motion` handling for pulse, equalizer bars, fade-in, and capture needle transitions.

7. Update the current range controls.
   - Replace the side-panel Low/High dropdown pair in `PitchCoachApp.tsx` with a compact range summary and "Edit range" button.
   - Keep dropdown fallback logic available only if tests or accessibility reveal the modal is too heavy for a sidebar edit. Preferred UI: `Range · C3-C5 · Edit`.
   - On save, call the existing `coach.setSettings` path so lessons reset naturally through the existing `settings.range` effect.

8. Testing and verification.
   - Unit tests:
     - `vocalRange.test.ts` for voice type guessing, octave formatting, setup range bounds, and save normalization.
     - `settingsStorage.test.ts` for `rangeSetup` defaults and legacy migration.
     - controller tests for save/skip transitions if the capture logic lands in `usePitchCoachController`.
   - Component tests:
     - modal opens in manual mode, stepper changes low/high with constraints, presets select exact notes, save persists range.
     - sing mode advances low -> high -> done using mocked capture frames.
     - skip marks `skipped` and leaves the range unchanged.
   - Browser tests:
     - fresh user clicks Start lesson, sees "Set your vocal range", saves `C3-C5`, then arrives in the drill.
     - skipped user can start a drill and later reopen setup from the recovery banner/range panel.
     - direct `/exercises/:id` route preserves the same gating behavior.
     - mobile viewport renders the modal without clipped text or unreachable actions.
   - Visual QA:
     - Run a local dev server and compare desktop screenshots against `Pitch Coach Range Setup.html` at 1240x800.
     - Verify manual edit, sing capture, saved view, skipped banner, and mobile stacked layout.
     - Run `pnpm test`, `pnpm build`, and the relevant `pnpm test:browser` coverage. Run `bash scripts/validate-changes.sh --scope baseline` before handoff if this becomes the implementation pass.

## Affected Areas
- `src/domain/contracts.ts`: add `VocalRangeSetup` types and `CoachSettings.rangeSetup`.
- `src/domain/exercise.ts`: update `DEFAULT_SETTINGS`; possibly keep scoring range normalization unchanged.
- `src/domain/vocalRange.ts`: new range setup helpers, voice presets, formatting, bounds.
- `src/storage/settingsStorage.ts`: normalize and migrate `rangeSetup`.
- `src/app/usePitchCoachController.ts`: expose range setup save/skip/edit state and optional live capture methods.
- `src/app/PitchCoachApp.tsx`: gate Start lesson, render modal/toast, replace sidebar range dropdowns with summary/edit.
- `src/components/range/`: new modal, keyboard, steppers, progress, summary, toast, and reference tone UI.
- `src/styles/app.css` and `src/styles/ui.css`: range setup overlay, card, keyboard, responsive, and motion styles.
- `src/audio/types.ts` / `src/audio/services.ts`: only if capture needs a named helper; prefer reusing existing services from the controller.
- `src/storage/settingsStorage.test.ts`, `src/domain/vocalRange.test.ts`, `src/app/PitchCoachApp.test.tsx`, and `tests/browser/app.spec.ts`: coverage for state, persistence, and flows.

## Checklist
- [x] Inspect onboarding and range setup mock source.
- [x] Inspect current app routing, controller, settings storage, range controls, and tests.
- [x] Choose the production flow target: refined range setup modal plus first-run gating on exercise start.
- [x] Define the proposed local data model and persistence migration.
- [x] Define product states for unseen, manual edit, sing capture, saved, skipped, completed, and later edit.
- [x] Implement domain types and range helpers.
- [x] Add settings migration and tests.
- [x] Add controller save/skip/capture API.
- [x] Build range setup components and CSS from the mock.
- [x] Wire exercise-start gating and range edit entry points.
- [x] Add unit, component, browser, and visual verification coverage.
- [x] Run deterministic validation.
