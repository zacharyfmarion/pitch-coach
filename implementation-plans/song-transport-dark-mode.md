# Song Transport And Dark Mode

## Goal

Rebase song mode onto the dark-mode main branch, keep `/songs` visually coherent in both themes, and add a pause/resume control next to Stop without changing interval practice behavior.

## Approach

Share the app theme application hook with song mode, pass the resolved theme into the song pitch timeline, convert song-specific CSS to existing theme variables, and add a paused song-practice state through the song controller and audio engine.

## Affected Areas

- `src/app/`
- `src/song/`
- `src/styles.css`
- `src/app/PitchCoachApp.test.tsx`
- `implementation-plans/`

## Checklist

- [x] Share theme application with the song route
- [x] Update song timeline and song CSS for dark mode
- [x] Add pause/resume support to song practice
- [x] Add regression coverage for song pause/resume and direct-route theme application
- [x] Validate tests and build
- [x] Prepare the rebased work for commit
