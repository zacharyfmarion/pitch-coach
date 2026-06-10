# Mock-Aligned App Redesign
## Goal
Rework Pitch Coach so the production app follows the standalone mock's product structure, interaction model, and warm visual system while preserving the existing privacy-first audio pipeline, URL-aware routing, local storage, scoring logic, and browser-only song processing.

The mock direction should be translated into a responsive production app rather than copied as a fixed 1240x800 frame. Core expectations:

- A persistent app shell with Home, Practice, Sing, and Progress sections.
- A consistent design system for buttons, icon buttons, sidebar navigation, cards, chips, controls, upload/drop zones, progress indicators, and practice status surfaces.
- Radix-backed primitives where Radix provides the right structure, especially navigation tabs, select/dropdown, switch, tooltip, dialog/alert dialog, progress, scroll area, and visually hidden affordances.
- A guided practice experience closer to the mock's hands-free loop: listen, get ready, sing, score, retry or auto-advance.
- Song mode surfaced as a first-class Sing tab with clearer idle, processing, ready, and practice states.
- Progress views based on existing local attempt history, not mocked stats.

## Approach
Treat this as a phased redesign because the mock changes both the visual language and the app information architecture.

1. Build the design-system foundation first.
   - Add a warm default theme inspired by the mock: paper background, ink text, coral primary, green success, amber warning, violet song accent, muted brown-gray text, soft borders, and subtle elevation.
   - Define semantic CSS tokens for layout, typography, radii, shadows, component states, and status colors.
   - Choose font strategy. The mock uses Bricolage Grotesque, Hanken Grotesk, and DM Mono; production should either vendor approved local font assets or use a system-stack fallback with equivalent roles.
   - Refactor existing UI primitives to share size, variant, focus, disabled, and icon alignment behavior.
   - Add missing primitives: AppShell, SidebarNav, Card, StatCard, Chip/Pill, ProgressBar, PageHeader, EmptyState, Dropzone, StatusPill, and CoachBubble.
   - Use Radix under the hood where useful:
     - `@radix-ui/react-tabs` or Radix Toggle Group for shell navigation and category filters.
     - Existing Radix Select for dropdowns.
     - Existing Radix Switch for toggles.
     - Existing Radix Tooltip for icon controls.
     - Add Radix Progress for progress bars.
     - Add Radix Alert Dialog for destructive local-history and clip clearing.
     - Add Radix Scroll Area only if native scrolling needs styled cross-browser structure.

2. Rebuild the app shell and top-level routes.
   - Extend route state from library/practice/songs to home/practice/sing/progress plus focused exercise practice.
   - Keep existing Vite `BASE_URL` route helpers intact.
   - Add a responsive left sidebar on desktop and a compact bottom/top navigation pattern on mobile.
   - Move theme/settings affordances into a consistent shell location without crowding practice controls.
   - Preserve direct URLs for exercise and song flows.

3. Implement the Home screen from real local data.
   - Show greeting, streak/local-save messaging, recommended exercise, mode cards, and stats.
   - Derive stats from attempt history: recent accuracy/pass rate, notes in tune, completed attempts, minutes practiced, last-practiced dates.
   - Compute a recommended exercise from recent common issues and last activity, falling back to the selected/default exercise.
   - Use the existing mini timeline or a small reusable pitch preview for the hero card.

4. Redesign the Practice Library.
   - Group current exercises by category and add category filters matching the mock's scan pattern.
   - Preserve existing exercise definitions; do not invent inaccessible locked content unless product wants gating.
   - Show difficulty, focus, key/current root, local progress, recent pass rate, and start controls in compact rows/cards.
   - Ensure rows open the existing focused exercise practice route.

5. Align focused exercise practice with the mock.
   - Keep `usePitchCoachController` as the coordination boundary.
   - Reshape existing lesson states into mock-style UI phases: listen/prompt, get ready/awaiting voice, sing/listening, scoring, retry, passed, complete.
   - Add CoachBubble copy driven by the selected exercise and attempt score.
   - Add note stones/checkpoints above the timeline using real `targetNotes` and `attemptScore`.
   - Convert the transport/status area into contextual actions: hear guide again, live listening state, retry countdown when appropriate, pause/stop/reset, and auto-advance indicator.
   - Keep microphone capture local and keep saved clips opt-in.
   - Avoid faking the animated replay flow; wire animation/progress to real prompt/capture state where available, and use deterministic UI fallbacks for tests.

6. Redesign Sing mode around the mock's phases.
   - Keep `useSongPracticeController`, Demucs/basic-pitch/reference scoring, and current local-only guarantees.
   - Replace the side-panel-heavy upload flow with a primary dropzone and pipeline card when idle.
   - Show analysis progress as a clear four-step pipeline: load track, get/cache model, separate vocals, map vocal.
   - Show ready state with duration/key/range/tempo chips and a mapped-vocal preview before starting practice.
   - Preserve advanced trimming/detail/debug controls, but move them into a secondary/details surface so the default path stays calm.

7. Build Progress from local history.
   - Add Progress route with stat cards, recent accuracy trend, week activity/streak, and recent sessions.
   - Extend domain progress helpers as needed for aggregate stats and trend buckets.
   - Store only derived local summaries or compute on load from existing attempt records; do not upload data.
   - Add empty states for new users.

8. Validate and polish.
   - Add Vitest coverage for route parsing, progress aggregation, recommended exercise selection, and any new design-system behavior that has logic.
   - Add component tests for key shell navigation and destructive dialogs.
   - Add Playwright coverage for Home -> Practice -> Exercise -> back, Home -> Sing, Progress, responsive navigation, and existing direct route behavior.
   - Run `pnpm build`, relevant `pnpm test` coverage, and `pnpm test:browser` for route/layout work.
   - Use screenshot checks during implementation for desktop and mobile so text, controls, and timelines do not overlap.

## Affected Areas
- `src/app/PitchCoachApp.tsx`: route model, app shell composition, Home/Practice/Sing/Progress screens, focused exercise entry.
- `src/app/usePitchCoachController.ts`: expose any additional derived practice state needed by the new UI without moving scoring into components.
- `src/components/ui/`: shared primitives, Radix wrappers, variants, cards, nav, chips, progress, dialogs, dropzone.
- `src/components/PitchTimeline.tsx`: visual styling and any mock-aligned overlay/checkpoint needs.
- `src/components/FeedbackList.tsx`: likely folded into note stones/coach feedback or restyled as a secondary detail.
- `src/domain/progress.ts`: aggregate local stats, trends, streaks, recommendations.
- `src/domain/exercise.ts` and `src/domain/contracts.ts`: only if categories/metadata need richer display labels.
- `src/song/SongPracticeScreen.tsx`: Sing tab flow and layout.
- `src/song/useSongPracticeController.ts`: expose pipeline stages and ready-state metadata cleanly if not already available.
- `src/styles/theme.css`, `src/styles/ui.css`, `src/styles/app.css`: tokenized theme and component/page styles.
- `tests/browser/app.spec.ts` and app/component/domain tests for new navigation and progress behavior.
- `package.json` and `pnpm-lock.yaml`: only if adding Radix packages not already installed.

## Checklist
- [x] Review the standalone mock structure and extract screens, tokens, and interaction states.
- [x] Compare mock direction with current routing, controller, UI primitive, song, and progress architecture.
- [x] Phase 1: Add design-system tokens and Radix-backed primitive coverage.
- [x] Phase 2: Implement responsive app shell and top-level Home/Practice/Sing/Progress routes.
- [x] Phase 3: Build Home and Practice Library using real local data.
- [x] Phase 4: Rework focused exercise practice UI around the guided mock flow.
- [x] Phase 5: Rework Sing mode idle/processing/ready/practice flow.
- [x] Phase 6: Add Progress dashboard and domain aggregate helpers.
- [ ] Phase 7: Add unit/component/browser coverage and run deterministic validation.
