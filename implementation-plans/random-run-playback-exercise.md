# Random Run Playback Exercise

## Goal

Add a configurable exercise that plays a generated melodic run, then asks the singer to reproduce it through the existing microphone pitch feedback flow. The user should be able to set the run length and difficulty, retry the same generated run after misses, and get a fresh generated run when they advance.

Assumption for this plan: "play them back" means sing the run back using the current browser microphone pitch detection. Instrument/MIDI input is out of scope unless the product direction changes.

## Approach

1. Add a first-class generated exercise type without bypassing the existing practice flow.
   - Add a catalog entry such as `random-run-playback` under the scale or interval category.
   - Keep it inside the normal exercise library, route system, prompt playback, timeline, scoring, local history, and progress surfaces.
   - Treat it as a sequence exercise: guide plays the generated notes, the singer reproduces them, scoring aligns sung pitch events to the generated targets.
   - Preserve the privacy model. Generated runs, sung pitch frames, and local clips remain browser-local.

2. Extend the domain model for generated patterns.
   - Add a small generated-pattern layer rather than hardcoding random behavior in React.
   - Introduce a pure `src/domain/randomRun.ts` module with:
     - `RandomRunConfig`: note count and difficulty.
     - `RandomRunDifficulty`: likely `1 | 2 | 3 | 4 | 5`, matching existing exercise difficulty language.
     - `GeneratedRandomRun`: seed, offsets, and generated `ExercisePatternSegment[]`.
     - `generateRandomRun(config, rootMidi, range, seed)` using a deterministic seeded PRNG.
   - Add a resolver such as `resolveExercisePatternSegments(exercise, context)` so static exercises continue returning fixed `patternSegments`, while random-run exercises return generated note segments.
   - Keep generated notes as normal `"note"` segments so `buildTargetNotes`, `TonePromptPlayer`, `PitchTimeline`, and `scoreAttempt` continue to work with minimal special casing.

3. Define difficulty in musical, testable terms.
   - Length means exact target-note count, for example 3-12 notes with a default around 5.
   - Difficulty controls allowed motion, not tempo:
     - 1: short stepwise major/pentatonic motion, narrow span, no large jumps.
     - 2: mostly stepwise diatonic motion with occasional thirds.
     - 3: diatonic runs across a wider span, more direction changes, thirds/fourths allowed.
     - 4: wider leaps and less predictable contours while staying vocal-range safe.
     - 5: challenging diatonic/chromatic-style runs with larger intervals and direction changes, still constrained to the singer's configured range.
   - Keep rhythm simple for the first pass: one note per beat. Rhythm variation can be a later feature because current scoring and timeline already work cleanly with equal note durations.

4. Make generation stable for each attempt.
   - Generate a run once when a new random-run challenge starts.
   - Store the active generated run in `usePitchCoachController` state/ref so the prompt, timeline, scoring, and attempt history all use the same targets.
   - Retry behavior should reuse the same generated run after a failed attempt.
   - Passing and advancing should generate a new run for the next root/key.
   - Provide an explicit "New run" control for users who want to skip/regenerate without changing exercise.

5. Update root/range behavior.
   - Continue using the existing root sequence and key stepper, but make random-run generation range-aware.
   - Ensure generated offsets fit within the configured vocal range for the selected root.
   - Update lesson reset when random-run config changes so stale generated targets do not remain visible or scorable.
   - If a requested length/difficulty cannot fit the range, degrade gracefully by narrowing allowed offsets before showing "range too narrow"; do not generate unreachable targets.

6. Persist user configuration locally.
   - Add browser-local settings for the random-run config, for example:
     - `randomRun: { length: number; difficulty: RandomRunDifficulty }`
   - Normalize malformed or old settings in `src/storage/settingsStorage.ts`.
   - Do not create a separate storage system; this belongs in `CoachSettings` with the rest of local practice preferences.

7. Add practice UI controls only where they are relevant.
   - Show random-run controls on the practice screen when the selected exercise is the generated run exercise.
   - Use compact controls that fit the existing practice header/control bar:
     - length stepper or slider
     - difficulty segmented control
     - "New run" icon button
   - Display the generated target pattern with the existing note checkpoint strip and timeline rather than adding a second visualization.
   - Keep the library card concise, for example "Generated runs" with a focus label like "Playback memory".

8. Adapt scoring duration to generated length.
   - Current sequence scoring max duration is based on static exercise duration.
   - Refactor scoring policy creation to account for the resolved target sequence duration, or add a helper that derives `attemptMaxDurationMs` from `targetSegments`.
   - This prevents long generated runs at slower tempos from timing out too early.

9. Persist enough history for useful review.
   - At minimum, attempts can aggregate under the new `random-run-playback` exercise id.
   - Prefer also storing generated-run metadata in attempt history, either by extending `AttemptHistoryRecord` with optional `generatedRun` metadata or by relying on the existing per-segment stored notes.
   - The first implementation should avoid changing progress semantics more than needed; progress can still show aggregate accuracy for the generated exercise.

10. Test in layers.
   - Unit tests for `randomRun.ts`:
     - deterministic output for the same seed/config/root/range
     - exact length
     - range safety
     - difficulty profiles produce allowed interval sizes/spans
     - graceful behavior with narrow ranges
   - Unit tests for exercise helpers:
     - static exercise generation remains unchanged
     - random-run target notes resolve to normal note segments
     - scoring max duration scales with generated length and tempo
   - Controller/component tests:
     - selecting the random-run exercise shows length/difficulty controls
     - guide playback receives the same generated targets shown in the UI
     - failed attempts retry the same run
     - passing or pressing "New run" changes the generated run
     - changing length/difficulty resets the generated run and persists settings
   - Browser tests:
     - library opens the random-run exercise route
     - controls fit on desktop and mobile
     - a mocked successful playback attempt records progress
   - Validation:
     - `pnpm test`
     - `pnpm build`
     - relevant `pnpm test:browser` coverage
     - `bash scripts/validate-changes.sh --scope baseline` before handoff

## Affected Areas

- `src/domain/contracts.ts`: add the random-run exercise id, generated-run config types, optional settings/history metadata.
- `src/domain/randomRun.ts`: new pure generator and difficulty profiles.
- `src/domain/exercise.ts`: add the catalog exercise, resolve generated pattern segments, adapt target construction helpers, and scale scoring duration from resolved targets.
- `src/storage/settingsStorage.ts`: normalize and persist random-run config.
- `src/domain/settings.ts`: add random-run config normalization helpers if they do not belong in `randomRun.ts`.
- `src/app/usePitchCoachController.ts`: own active generated-run state, generate/reuse/regenerate at the correct lifecycle points, expose config updates and a new-run action.
- `src/app/PitchCoachApp.tsx`: add random-run controls to the practice screen and expose "New run" on desktop/mobile layouts.
- `src/domain/progress.ts`: optionally preserve generated-run metadata while keeping aggregate progress by exercise id.
- `src/domain/*test.ts`, `src/app/PitchCoachApp.test.tsx`, and `tests/browser/app.spec.ts`: add unit, component, and browser coverage for generated runs.

## Checklist

- [x] Inspect current exercise definitions, lesson state, prompt playback, scoring, settings, progress, and practice UI.
- [x] Define the feature assumption and implementation boundary.
- [x] Create this implementation plan.
- [x] Add generated-run domain types and deterministic generator.
- [x] Add random-run settings normalization and local persistence.
- [x] Add the generated exercise catalog entry and target resolution path.
- [x] Update controller lifecycle to generate, reuse, retry, and regenerate runs.
- [x] Add practice-screen controls for length, difficulty, and new-run generation.
- [x] Adjust scoring duration for resolved/generated target sequences.
- [x] Preserve useful generated-run history/progress metadata.
- [x] Add unit, component, and browser tests.
- [x] Run deterministic validation.
