# GitHub Pages Hyphenated Base Path

## Goal

Publish Pitch Coach assets and documented links for the `/pitch-coach/` GitHub Pages path instead of `/pitch_coach/`.

## Approach

Make the Pages base path configurable from the deployment workflow, set that workflow value to `/pitch-coach/`, and keep Vite's local development base at `/`.

## Affected Areas

- `vite.config.ts`
- `.github/workflows/deploy-pages.yml`
- `README.md`
- `AGENTS.md`

## Checklist

- [x] Add an explicit GitHub Pages base-path override
- [x] Point the deploy workflow at `/pitch-coach/`
- [x] Update repository documentation that names the deployed URL or build behavior
- [x] Validate the production build and route-sensitive browser coverage
