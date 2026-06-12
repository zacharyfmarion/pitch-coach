# Settings Flow Foundation
## Goal
Implement the settings flow from the `Pitch Coach UI Redesign (5)` mocks as a modal settings surface opened from the sidebar footer account/local-practice row, with production behavior for voice range, practice defaults, audio input selection, input level monitoring, reset, and responsive layout.

The implementation should use this feature as the foundation for future settings rather than a one-off modal. Settings must remain browser-local, preserve the existing privacy model, and reuse current range, control, audio, storage, and shell patterns wherever possible.

## Approach
1. Treat the settings mocks as a sectioned settings surface, not a new route.
   - Source mocks inspected: `Pitch Coach Settings.html`, `settings-sheets.jsx`, `settings-shared.jsx`, `settings-controls.jsx`, `home-shared.jsx`, `rangesetup-kbd.jsx`, and `rangesetup-modal.jsx`.
   - Use the mock's two-pane layout as the desktop target because it scales better as more settings are added.
   - Use the same sections in a single-column layout on narrow viewports so mobile does not depend on the hidden desktop sidebar footer.
   - Initial sections:
     - `Voice`: vocal range summary, draggable keyboard, low/high note steppers, and "Re-test by singing".
     - `Practice`: default guide tempo and strictness.
     - `Audio`: microphone selection and input level.
   - Keep the dialog modal over the current app shell, matching the mock overlay, card radius, left section list, Done button, and reset affordance.

2. Wire the entrypoint through the existing sidebar footer.
   - Update `LocalSaveFooter` in `src/app/PitchCoachApp.tsx` so the lower local-practice/account card becomes a real settings trigger.
   - Keep the streak card as passive status and make only the account/local-practice row button-like, with a gear affordance matching the mock.
   - Pass `onOpenSettings` from `ExercisePracticeApp` through `MainShell` into `LocalSaveFooter`; render the settings dialog beside the existing range setup modal so it can share controller state.
   - Because `.sidebar-nav__footer` is hidden below the mobile breakpoint, add a compact settings icon button to the sticky mobile nav/header area or make the footer row available in a mobile-safe way. The settings feature should not disappear on mobile.
   - Preserve top-level route behavior. Opening settings should not mutate the URL and should close on route changes if the shell context changes.

3. Add a small settings architecture layer around the existing `CoachSettings`.
   - Do not create a second settings store. Continue using `CoachSettings`, `normalizeSettings`, `loadSettings`, and `saveSettings` as the persisted source of truth.
   - Add a pure `src/domain/settings.ts` module for settings-only constants and helpers that are not exercise generation:
     - `SettingsSectionId = "voice" | "practice" | "audio"`.
     - `SCORING_STRICTNESS_PRESETS` mapping `gentle -> 50`, `standard -> 35`, and `strict -> 22` cents, matching the mock.
     - Helpers to map `toleranceCents` to an exact or nearest strictness preset without duplicating scoring policy logic in components.
     - `DEFAULT_TEMPO_OPTIONS` for Slow `70`, Medium `90`, and Brisk `110`.
     - Audio input preference normalization helpers.
   - Keep `range` and `rangeSetup` as the voice source of truth. The settings flow should use the same range normalization and completion metadata as onboarding.
   - Keep `toleranceCents` as the scoring source of truth. The strictness segmented control writes preset cent values through the same `coach.setSettings` path used today.
   - Add a persisted `defaultTempoBpm` field so the settings dialog's "Default guide tempo" is not confused with the current live drill tempo.
     - Migrate legacy settings with `defaultTempoBpm = settings.defaultTempoBpm ?? settings.tempoBpm ?? DEFAULT_SETTINGS.tempoBpm`.
     - Keep `tempoBpm` as the active lesson tempo for current drills.
     - When selecting a new exercise, initialize `tempoBpm` from `defaultTempoBpm` instead of always replacing it with `exercise.defaultTempoBpm`.
     - When the settings dialog changes `defaultTempoBpm`, update the current `tempoBpm` only if the user has not already made an obvious live tempo adjustment in the current lesson.
   - Add a persisted audio input preference:
     ```ts
     export type PreferredAudioInput = {
       deviceId?: string;
       label?: string;
       selectedAt?: string;
     };
     ```
     Store it on `CoachSettings` as an optional browser-local preference. Normalize missing, malformed, or unavailable devices back to default input behavior.

4. Reuse and extract range UI instead of copying it.
   - `RangeSetupModal.tsx` already has the production keyboard, note steppers, voice type presets, summary formatting, reference tone playback, and range capture integration.
   - Extract reusable pieces from `src/components/range/RangeSetupModal.tsx` into small exported components under `src/components/range/`:
     - `RangeKeyboard`
     - `NoteStepper`
     - `RangeSummary`
     - `VoiceTypePresetList` if useful for the settings Voice section
   - Keep `RangeSetupModal` as the flow for first-run onboarding and "Find it by singing".
   - In the Settings Voice section, use the extracted keyboard and steppers inline for manual edits.
   - Make "Re-test by singing" launch the existing range setup capture flow in edit/sing context rather than adding a second microphone capture implementation.
   - Persist range edits through `coach.saveRangeSetup(range, source)` so song mode, scoring, root selection, and onboarding status all see the same range.

5. Add browser-local audio device support behind `src/audio`.
   - Extend the audio boundary rather than calling `navigator.mediaDevices` directly from settings components.
   - Add an audio input device service in `src/audio`, for example:
     - `listAudioInputDevices(): Promise<AudioInputDevice[]>`
     - `subscribeToAudioInputDevices(onChange): () => void`
     - `requestAudioInputPermission()` only when needed for labels or level monitoring.
   - Extend `AudioCaptureConfig` with an optional `deviceId`.
   - Update `BrowserAudioEngine.startCapture` to pass the selected `deviceId` into `getUserMedia` when present.
   - Ensure exercise capture, range capture, and song practice capture all use the preferred input through their existing service/controller paths.
   - Build the input level meter from local pitch/audio frames or a small meter-only capture adapter. It should never upload audio and should stop cleanly when the settings dialog closes.
   - Handle permission-denied, unsupported-browser, no-device, and changed-device states with concise copy in the Audio section.

6. Build a reusable settings dialog component system.
   - Add `src/components/settings/SettingsDialog.tsx` as the orchestrator.
   - Add focused primitives in `src/components/settings/`:
     - `SettingsShell`
     - `SettingsSectionNav`
     - `SettingsSection`
     - `SettingRow`
     - `SettingsFooter`
     - `InputLevelMeter`
   - Reuse existing app primitives where they fit:
     - `Toggle` for binary settings.
     - `SegmentedControl` for strictness.
     - `Dropdown` for microphone selection.
     - `Button` and `IconButton` for Done, reset, close, and retest actions.
     - Lucide icons for `Settings`, `Mic`, `Target`, `Gauge`, `Waveform`, `RotateCcw`, and `X`.
   - Prefer CSS classes in `src/styles/app.css` or `src/styles/ui.css` over mock-style inline styles.
   - Keep the component API section-based so future settings can be added by registering a new section object and content component rather than rewriting dialog chrome.

7. Match the mock while fitting the production design system.
   - Desktop target:
     - Modal width about `760px`.
     - Left rail about `226px`.
     - Overall height about `600px`, capped by viewport.
     - Overlay `rgba(44,32,22,0.42)` with `backdrop-filter: blur(2px)`.
     - Card radius `22px`, warm card/background tokens, and the existing coral accent.
   - Single-column/mobile target:
     - Max width `calc(100vw - 32px)`.
     - Max height `calc(100vh - 32px)`.
     - Section nav becomes horizontal tabs or a stacked section list.
     - Footer actions wrap without clipping.
   - Follow reduced-motion behavior already used by range setup and mock-aligned pages.
   - Avoid duplicating card-in-card layouts; use full dialog panels and row dividers like the mock.

8. Decide how reset applies before implementation.
   - Preferred behavior: Reset to defaults resets the settings represented in this dialog only:
     - Voice: default range `C3-C5` and `rangeSetup` source `default`.
     - Practice: default tempo and standard strictness.
     - Audio: clear preferred microphone and return to browser default input.
   - Keep existing local practice history and saved clips untouched. Resetting settings must not delete user progress or audio clips.
   - If reset is immediate, use the existing normalized settings path and show no destructive confirmation because it is reversible through controls.
   - If a draft model is introduced for the dialog, reset should update the draft and commit only on Done. Choose one interaction model and cover it in tests.

9. Keep existing practice controls coherent.
   - The practice side panel currently has live Range, Scoring, and Local clips controls.
   - After the settings dialog lands:
     - Range can stay in the practice side panel as a fast edit affordance, but it should use the same extracted range summary/control code.
     - Live tempo can stay in the practice side panel as an in-session adjustment.
     - Strictness should either move fully to settings or be clearly labeled as the current session's tolerance if it remains in practice.
     - Local clips can remain in the practice side panel for now, or become a future `Privacy & storage` settings section. Do not bury clip playback/delete controls inside the new settings dialog unless the product explicitly asks.

10. Test and verify the full flow.
   - Unit tests:
     - `src/domain/settings.test.ts` for strictness mapping, tempo defaults, and audio preference normalization.
     - `src/storage/settingsStorage.test.ts` for `defaultTempoBpm` and preferred audio input migration.
     - Controller tests proving exercise selection uses `defaultTempoBpm` and capture uses the preferred audio input when present.
   - Component tests:
     - Settings opens from the sidebar footer account/local-practice row.
     - Section nav switches between Voice, Practice, and Audio.
     - Voice range edits use the shared range helpers and persist through `saveRangeSetup`.
     - Strictness and tempo controls update settings through normalized values.
     - Reset only resets settings covered by the dialog.
     - Audio device states render default, selected, permission denied, and no-device cases.
   - Browser tests:
     - Desktop footer entrypoint opens the two-pane dialog.
     - Mobile settings entrypoint exists even though the sidebar footer is hidden.
     - Dialog fits without clipped text at mobile and desktop sizes.
     - Audio permission/device mocks do not leak browser errors to the UI.
   - Validation:
     - Run `pnpm test`.
     - Run `pnpm build`.
     - Run relevant `pnpm test:browser` coverage because this adds a new user-facing modal flow and responsive entrypoint.
     - Run `bash scripts/validate-changes.sh --scope baseline` before handoff in the implementation pass.

## Affected Areas
- `src/domain/contracts.ts`: add `defaultTempoBpm` and preferred audio input types to `CoachSettings`.
- `src/domain/exercise.ts`: update `DEFAULT_SETTINGS` and exercise selection assumptions around active tempo vs default tempo.
- `src/domain/settings.ts`: new pure settings helpers for sections, strictness presets, tempo defaults, and audio preference normalization.
- `src/storage/settingsStorage.ts`: normalize and migrate new fields while preserving existing settings.
- `src/audio/types.ts`: allow an optional audio input device id in capture config.
- `src/audio/AudioEngine.ts`: pass preferred input constraints to `getUserMedia`.
- `src/audio/services.ts`: expose audio input device listing/monitoring behind the audio service boundary.
- `src/app/usePitchCoachController.ts`: expose settings update helpers, route selected input into capture, and coordinate input level monitoring.
- `src/app/PitchCoachApp.tsx`: own settings dialog open state, pass the footer entrypoint callback, render the dialog, and keep range setup handoff working.
- `src/components/range/`: extract reusable range keyboard, stepper, summary, and preset pieces from `RangeSetupModal`.
- `src/components/settings/`: new settings dialog and section components.
- `src/styles/app.css` and `src/styles/ui.css`: settings dialog, footer trigger, responsive layout, and meter styles.
- `src/song/useSongPracticeController.ts`: use preferred audio input for song practice capture if the audio service contract changes there too.
- `src/storage/settingsStorage.test.ts`, `src/domain/settings.test.ts`, `src/app/PitchCoachApp.test.tsx`, and `tests/browser/app.spec.ts`: coverage for persistence, section behavior, entrypoints, and responsive flow.

## Checklist
- [x] Inspect the settings mock files and related shared mock primitives.
- [x] Inspect the existing sidebar footer, settings storage, controller, range setup, audio engine, and UI primitives.
- [x] Identify reusable code from range setup and existing controls.
- [x] Define the settings entrypoint and responsive access strategy.
- [x] Define the proposed settings data model changes.
- [x] Create this implementation plan.
- [ ] Add pure settings helpers and type changes.
- [ ] Add settings storage migration and tests.
- [ ] Add preferred audio input service support.
- [ ] Extract reusable range components.
- [ ] Build the settings dialog and section components.
- [ ] Wire the sidebar footer and mobile entrypoint.
- [ ] Wire settings updates into exercise, range, audio, and song capture flows.
- [ ] Add component and browser coverage.
- [ ] Run deterministic validation.
