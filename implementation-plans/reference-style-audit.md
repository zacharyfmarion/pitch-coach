# Reference Style Audit
## Goal
Align the current app styling with the source files in `/Users/zacharymarion/Desktop/Pitch Coach UI Redesign/`, especially shared palette, typography, spacing, card styling, page headers, and the Sing empty/processing states.

## Approach
- Extract canonical palette and text scale from `home-shared.jsx` and page-level mock files.
- Replace screenshot-derived and late oversized CSS overrides in `index.html` with source-mock values.
- Keep existing React app behavior and local song/practice functionality intact.
- Visually verify Home, Sing empty, Sing processing, Practice, and Progress after the style pass.

## Affected Areas
- `index.html`
- `implementation-plans/reference-style-audit.md`

## Checklist
- [x] Extract reference palette and type scale.
- [x] Patch app-level tokens and mock component CSS.
- [x] Verify visually against the source mock pages.
- [x] Run lint/build/browser validation.
- [x] Commit the completed style audit.
