# Home Sidebar Mock Parity
## Goal
Make the production Home screen and sidebar match the provided mock screenshot as closely as possible before continuing with other app areas.

## Approach
- Lock the app to the warm mock theme and remove visible theme switching from the shell.
- Replace the Home screen with a mock-faithful layout: greeting, weekly streak, resume hero, interval/song cards, stats row, and mock sidebar footer.
- Put the Home/sidebar styling in `index.html` as requested, using targeted selectors so other app areas can keep functioning.
- Scale the mock layout down into a normal full-viewport web app rather than using the screenshot's oversized export dimensions.
- Preserve real navigation actions behind the mock-shaped cards.
- Update tests that assumed the old shell/theme picker.

## Affected Areas
- `index.html`
- `src/app/PitchCoachApp.tsx`
- `src/app/theme.ts`
- Home/sidebar-related tests

## Checklist
- [x] Lock the theme and remove theme picker UI.
- [x] Rebuild Home and sidebar markup to match the screenshot.
- [x] Add mock Home/sidebar styling in `index.html`.
- [x] Resize the mock into a full-viewport web app with no screenshot frame.
- [x] Update focused tests and browser coverage.
- [x] Validate locally and visually inspect.
