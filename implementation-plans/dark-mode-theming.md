# Dark Mode Theming

## Goal

Add first-party theme support with light, dark, and system preferences, persisted in local settings and applied across the app UI.

## Approach

1. Extend settings with a normalized theme preference that defaults to system.
2. Add an app-level theme resolver that applies the effective theme to the document and reacts to system preference changes.
3. Replace direct color literals with semantic CSS variables for light and dark themes.
4. Add a compact theme control on library and practice screens.
5. Pass the resolved theme into the pitch timeline so canvas drawing uses matching colors.
6. Cover persistence, UI behavior, system defaults, and browser reload behavior with tests.

## Affected Areas

- `src/domain/contracts.ts`
- `src/domain/exercise.ts`
- `src/storage/settingsStorage.ts`
- `src/app/PitchCoachApp.tsx`
- `src/components/PitchTimeline.tsx`
- `src/styles.css`
- `tests/browser/app.spec.ts`

## Checklist

- [x] Add settings type/default/normalization support
- [x] Add app theme resolver and theme picker UI
- [x] Convert CSS and canvas colors to theme-aware tokens
- [x] Add unit and browser coverage
- [x] Run baseline and browser validation
- [x] Commit, push, and open a draft PR
