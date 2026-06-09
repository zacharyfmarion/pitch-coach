# App Organization Product Architecture

## Goal

Reorganize Pitch Coach around the singer's practice workflow instead of the current implementation-oriented screen structure. The app should make it obvious what to practice, how to prepare, when to sing, how the attempt went, and what to do next, while preserving the privacy-first browser-local architecture.

## Approach

Treat this as a product architecture pass before deeper visual redesign. The current app has strong technical primitives in `src/domain`, `src/audio`, `src/storage`, and `src/song`, but the React surface has grown around one large app file and broad controllers. The work should separate app shell, routing, exercise library, exercise practice, song practice, progress, settings, and review surfaces into named product modules.

The target user journey is:

1. Choose what to practice.
2. Prepare the attempt.
3. Sing the attempt.
4. Review what happened.
5. Decide what to do next.

Controls and information should be disclosed according to that journey. Setup and preferences should not compete with live practice. Review and next-step guidance should become prominent after an attempt. Song mode should behave like a prepare/analyze/practice workflow rather than an empty timeline with controls in a side rail.

## Affected Areas

- `src/app/PitchCoachApp.tsx`: currently owns routing, shell, library, practice UI, theme selection, settings panels, history, and route helpers.
- `src/app/usePitchCoachController.ts`: currently returns session, settings, progress, local clips, history, and service actions from one broad controller.
- `src/song/SongPracticeScreen.tsx`: currently presents upload, analysis, mix, debug, feedback, timeline, and transport as one screen.
- `src/song/useSongPracticeController.ts`: current song lifecycle can remain service-oriented, but should be shaped into prepare, analyze, practice, and review view models.
- `src/styles/app.css`: layout currently gives timeline and side rail equal static priority, which can hide the primary transport on desktop.
- `src/domain/exercise.ts`: exercise metadata already supports library grouping by category, focus, and difficulty.
- `src/domain/progress.ts`: progress summaries already support next-practice recommendations and richer library states.
- `tests/browser/app.spec.ts`: browser coverage should follow the new route and workflow hierarchy.

## Checklist

- [x] Extract app shell and route helpers from `src/app/PitchCoachApp.tsx`.
- [x] Create feature folders for exercises, songs, and progress-oriented UI.
- [x] Move the exercise library into an `ExerciseLibraryScreen` module.
- [x] Move exercise practice into an `ExercisePracticeScreen` with separate setup, live, and review panels.
- [x] Keep the primary transport visible across desktop and mobile practice layouts.
- [x] Replace the always-on exercise side rail with state-aware panels for setup, feedback, and history.
- [x] Redesign the exercise library around recommended next practice, grouped drills, recent activity, and progress signals.
- [x] Use existing exercise metadata from `src/domain/exercise.ts` for grouping and difficulty presentation.
- [x] Use existing progress summaries from `src/domain/progress.ts` to drive recommendation and history states.
- [ ] Reframe song mode around upload, trim, analyze, practice, and review states.
- [ ] Make song upload and analysis own the empty state before a reference exists.
- [ ] Keep song debug controls hidden from the primary workflow unless explicitly enabled.
- [ ] Split broad controller return values into smaller view models where it improves screen clarity.
- [ ] Preserve browser-local privacy boundaries for microphone audio, uploaded song audio, pitch frames, clips, and model processing.
- [ ] Update component and browser tests for the reorganized routes and workflows.
- [ ] Run `pnpm test`, `pnpm build`, and relevant Playwright coverage after implementation.
