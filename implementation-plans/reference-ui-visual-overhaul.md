# Reference UI Visual Overhaul

## Goal

Rework Pitch Coach's visual system so it feels closer to the desktop-tool design language in `/Users/zacharymarion/Documents/code/tree-maker-rust` and `/Users/zacharymarion/Documents/code/cascade`: compact, precise, dark-first, icon-forward, and built from reusable panel/control primitives.

The app should still open on the usable exercise library, preserve the privacy-first practice workflow, and avoid changes to audio capture, scoring, exercise generation, routing behavior, or local persistence beyond UI-facing state.

## Approach

1. Add full preset-based theme support, starting with two shipped themes.
   - Create a `src/themes/` layer modeled after Tree Maker's theme system: typed token schema, preset registry, `applyTheme`, and a small persistence adapter.
   - Ship only `One Dark` and `Atom One Light` initially, copied/adapted from Tree Maker, but make adding future presets a data operation: add a JSON file, import it in the registry, and expose it in the theme UI.
   - Store theme preference as an explicit mode plus theme selection, not just a boolean light/dark value. Suggested shape: `system` mode resolves to default dark/light preset, while `theme` mode stores a preset name.
   - Keep backward compatibility for the current `"system" | "light" | "dark"` saved values by normalizing them into the new theme model.
   - Apply the selected theme by writing theme token CSS variables to `document.documentElement`, including `data-theme-name` and `data-theme-type` attributes for tests and debugging.

2. Port the shared design token foundation from the reference apps into Pitch Coach.
   - Adopt the Tree Maker/Cascade variable shape: `--space-*`, `--radius-*`, `--bg-*`, `--text-*`, `--border-*`, `--accent-*`, and `--status-*`.
   - Derive app-specific aliases from the active theme rather than hard-coding light and dark CSS branches.
   - Add Pitch Coach-specific tokens for pitch timeline colors, target bands, pitch traces, range accents, pass/retry badges, and privacy/status surfaces.

3. Copy the small reusable UI component layer from Tree Maker, adapted to Pitch Coach naming and dependencies.
   - Add `Button`, `IconButton`, `Tooltip`, `Toggle`, `SegmentedControl`, and shared control style constants under `src/components/ui/`.
   - Add the missing lightweight dependencies used by the donor components: `class-variance-authority`, `@radix-ui/react-tooltip`, and `@radix-ui/react-switch`.
   - Keep `@radix-ui/react-select` and either restyle the current `Dropdown` to the donor Select classes or wrap the donor Select primitives behind the existing generic `Dropdown` API so current tests and call sites stay simple.

4. Convert the app shell from soft cards to a compact practice workspace.
   - Replace the current padded page shell with a full-viewport `app-layout` style shell and a 36px-ish toolbar.
   - Use icon buttons with tooltips for navigation, theme actions, reset/stop, local clip actions, and history clearing.
   - Use dense readouts for selected exercise, key, attempt, status, tempo, tolerance, and pass/retry state.

5. Redesign the exercise library as the first-screen workspace.
   - Keep "Practice Library" as the primary first screen, but style it like a start/workspace screen from Tree Maker rather than a marketing hero.
   - Use a compact exercise browser with difficulty meters, focus/category chips, pattern text, local progress, and a clear start/open affordance.
   - Preserve exercise buttons as accessible navigation targets and keep selected exercise feedback visible.

6. Redesign the practice screen around panel primitives.
   - Main area: timeline panel with a compact header, metric strip, and transport toolbar.
   - Side area: inspector-style stacked sections for Range, Scoring, Latest Clip, Feedback, and History.
   - Replace the checkbox for local clips with the donor `Toggle`; keep range sliders and dropdowns stable, compact, and keyboard accessible.
   - Retain the existing route-aware back behavior and exercise dropdown behavior.

7. Retune visualizations and feedback components.
   - Update `PitchTimeline` to read active CSS variables, so future themes automatically style the canvas without adding new TypeScript palettes.
   - Restyle `FeedbackList`, attempt history, score badges, error banners, and empty states to match the panel/control system.
   - Keep canvas dimensions stable across desktop and mobile so pitch feedback does not jump during repeated practice.

8. Split styles for maintainability.
   - Move static global/token/control styles into `src/styles/theme.css` and `src/styles/ui.css`.
   - Keep product layout styles in `src/styles/app.css`.
   - Import them from `src/main.tsx` in a predictable order before component code renders.

9. Update and extend tests around behavior, not pixel-perfect styling.
   - Keep existing routing, theme persistence, dropdown, local history, and no-native-select tests passing.
   - Add tests for theme preset normalization, persisted preset selection, system default resolution, theme attributes, and the initial two presets.
   - Add or adjust component tests for the theme picker, `Toggle`, `IconButton` tooltip labeling, and the retained `Dropdown` abstraction if the implementation changes.
   - Update Playwright coverage for the redesigned library/practice screens and mobile usability.
   - Run deterministic validation with `pnpm test`, `pnpm build`, `pnpm test:browser`, and `bash scripts/validate-changes.sh --scope baseline`.

## Affected Areas

- `package.json`
- `pnpm-lock.yaml`
- `src/main.tsx`
- `src/styles/theme.css`
- `src/styles/ui.css`
- `src/styles/app.css`
- `src/themes/applyTheme.ts`
- `src/themes/index.ts`
- `src/themes/types.ts`
- `src/themes/presets/one-dark.json`
- `src/themes/presets/atom-one-light.json`
- `src/app/PitchCoachApp.tsx`
- `src/components/Dropdown.tsx`
- `src/components/FeedbackList.tsx`
- `src/components/PitchTimeline.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/IconButton.tsx`
- `src/components/ui/SegmentedControl.tsx`
- `src/components/ui/Toggle.tsx`
- `src/components/ui/Tooltip.tsx`
- `src/components/ui/controlStyles.ts`
- `src/song/SongPitchTimeline.tsx`
- `src/song/SongPracticeScreen.tsx`
- `src/domain/contracts.ts`
- `src/domain/exercise.ts`
- `src/storage/settingsStorage.ts`
- `src/app/PitchCoachApp.test.tsx`
- `src/components/Dropdown.test.tsx`
- `src/components/dropdownUsage.test.ts`
- `src/storage/settingsStorage.test.ts`
- `tests/browser/app.spec.ts`

## Checklist

- [x] Audit Pitch Coach's current UI surface
- [x] Audit Tree Maker and Cascade UI tokens/components
- [x] Add data-driven theme preset architecture
- [x] Add initial One Dark and Atom One Light presets
- [x] Normalize existing theme settings into the new theme model
- [x] Add reference-inspired design tokens to Pitch Coach
- [x] Add adapted shared UI primitives and dependency updates
- [x] Restyle `Dropdown` and theme controls
- [x] Rework the exercise library screen
- [x] Rework the practice workspace screen
- [x] Adapt rebased song mode to shared themes and UI primitives
- [x] Retune timeline, feedback, badges, errors, and history styles
- [x] Update unit/component/browser tests
- [x] Run unit tests, build, browser tests, and baseline validation
- [x] Verify desktop and mobile layouts visually in the browser
