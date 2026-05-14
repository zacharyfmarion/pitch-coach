# Browser Local Song Mode

## Goal

Add a browser-local song practice mode where a singer uploads a trimmed section, locally separates vocals, extracts a reference pitch contour, and practices against accompaniment without uploading audio.

## Approach

Build song mode as a separate `/songs` route with pure song analysis/scoring helpers, browser-only audio/model services, a focused React controller, and Cloudflare Pages deployment support for cross-origin isolation. Use WebGPU-only separation for v1 and disable the mode when the runtime requirements are not met.

## Affected Areas

- `src/song/`
- `src/app/PitchCoachApp.tsx`
- `src/audio/`
- `tests/browser/`
- `.github/workflows/`
- `vite.config.ts`
- `wrangler.toml`

## Checklist

- [x] Add lazy WebGPU vocal-separation and model-cache services
- [x] Add reference contour extraction and song scoring with focused tests
- [x] Add `/songs` routing, upload/trim/analyze/practice UI, and timeline rendering
- [x] Add song practice audio playback plus microphone pitch capture
- [x] Move production deployment to Cloudflare Pages with isolation headers
- [x] Validate with unit, build, and browser coverage
- [x] Open a draft PR against `main`
