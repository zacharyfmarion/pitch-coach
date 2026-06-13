# Mobile Responsive Bottom Navigation
## Goal
Make the mock-aligned Pitch Coach app feel intentionally designed on phones, especially around the bottom navigation bar, while preserving the existing desktop sidebar, URL-backed routes, local-only audio model, and focused exercise practice flow.

The key mock direction is not the phone bezel or fake status bar. It is the app structure: one scrollable mobile screen per top-level destination, a persistent safe-area-aware bottom tab bar for Home, Practice, Sing, and Progress, compact one-column content, horizontally scrollable controls where needed, and enough bottom padding that primary actions, range prompts, and nav never collide.

## Approach
1. Turn the shell into a real responsive shell.
   - Keep the current desktop sidebar for wider viewports.
   - Add a reusable bottom navigation component fed by the existing `navigationItems`.
   - Map route values to mock labels: `home` = Home, `library` = Practice, `songs` = Sing, `progress` = Progress.
   - Below the mobile breakpoint, hide the sidebar and show a fixed bottom tab bar with `env(safe-area-inset-bottom)` padding, backdrop blur, icon + label items, and active coral styling from the mocks.
   - Prefer `100dvh` shell sizing on mobile and one scroll container per screen so Safari address-bar changes do not trap content.

2. Separate focused practice from top-level mobile navigation.
   - Keep the exercise detail route accessible from the Practice tab, but do not show the bottom tab bar inside the focused exercise loop.
   - Match the mobile exercise mock instead: compact top row with back, exercise title, take/key metadata, and play/pause; scrollable content with coach bubble, checkpoints, score, roll, and transport.
   - Keep the current horizontal chip controls for Key, Strictness, Tempo, and Auto/Manual, but make them stable and touch-friendly with overflow scrolling at phone widths.

3. Convert top-level pages to mobile-specific responsive variants.
   - Home: stack greeting, week summary, resume hero, mode rows/cards, and a two-column stats grid; collapse the resume pitch preview above or inside the card instead of preserving the desktop side-by-side split.
   - Practice Library: use the mock's single-column drill rows on phones, horizontal filter chips, sticky-ish heading only if it does not cost too much vertical space, and icon-only play affordances.
   - Sing: keep idle, processing, ready, and practice states; on mobile use a single column, vertical pipeline, compact analysis chips, and full-width primary actions.
   - Progress: two-column metric cards, then stacked accuracy, week, and recent-session panels.

4. Resolve bottom fixed surfaces.
   - Add a shared mobile bottom inset CSS variable for the tab bar height.
   - Add bottom padding to top-level mobile screens using that variable.
   - When the range setup prompt appears on Home or Practice, position it above the bottom nav and keep it narrow enough for a 390px viewport.
   - Ensure portaled dialogs and popovers still sit above the nav and remain reachable.

5. Move responsive overrides out of brittle inline CSS where practical.
   - The current `index.html` contains a large mock-parity stylesheet with mobile rules that make the desktop sidebar into a top strip at `760px`.
   - Keep the visual values, but migrate the new mobile shell/nav rules into `src/styles/app.css` or `src/styles/ui.css` so the behavior is testable and easier to maintain.
   - Avoid expanding the `!important` layer unless needed to bridge existing mock-parity overrides.

6. Verify with responsive browser coverage.
   - Add Playwright checks at `390x844` for Home, Practice, Sing, Progress, and direct exercise routes.
   - Assert the bottom nav is visible on top-level mobile routes, active route state updates, and it is absent on focused exercise practice.
   - Assert the range prompt sits above the bottom nav.
   - Add layout assertions or screenshots for no horizontal document overflow and visible primary actions.
   - Run `pnpm build`, relevant `pnpm test`, and `pnpm test:browser` after implementation.

## Affected Areas
- `src/components/ui/AppShell.tsx`: optional mobile navigation slot or shell-level bottom nav composition.
- `src/components/ui/SidebarTabs.tsx` and/or new `BottomNav.tsx`: shared nav item shape with touch-friendly bottom-tab rendering.
- `src/app/PitchCoachApp.tsx`: pass mobile nav to the shell on top-level routes and omit it from focused exercise practice.
- `src/styles/ui.css`: shell layout, bottom tab bar, safe-area variables, focus/active nav states.
- `src/styles/app.css`: mobile page padding, Home/Practice/Sing/Progress collapse rules, exercise mobile layout, range prompt offset.
- `index.html`: remove or narrow old mobile mock overrides that force the sidebar into a top nav.
- `tests/browser/app.spec.ts`: responsive navigation, direct route, and bottom inset coverage.

## Checklist
- [x] Review mobile mock files: `m-shared.jsx`, `m-home.jsx`, `m-practice.jsx`, `m-sing.jsx`, `m-progress.jsx`, and `m-practice-screen.jsx`.
- [x] Compare the mock direction with the current production shell, routes, responsive CSS, and existing Playwright mobile coverage.
- [x] Add bottom navigation shell support and safe-area spacing.
- [x] Adapt top-level pages to phone-specific layouts.
- [x] Adapt focused exercise practice for mobile without bottom navigation.
- [x] Reposition the range setup prompt above mobile bottom navigation.
- [x] Move responsive behavior into maintainable source CSS.
- [x] Add browser coverage for mobile top-level routes and focused practice.
- [x] Run local validation and visually inspect 390px and tablet breakpoints.
- [x] Replace the mobile Home route with mock-shaped mobile components instead of desktop Home overrides.
- [x] Add browser coverage for the mobile Home component structure.
- [x] Implement the latest mobile exercise screen mock from `Pitch Coach UI Redesign (6)`.
- [x] Add browser coverage for the latest mobile exercise screen structure and sheets.
- [x] Animate the mobile exercise bottom sheets with the mock slide-up and backdrop fade timing.
