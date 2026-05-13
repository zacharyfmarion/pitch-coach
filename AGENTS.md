# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

Pitch Coach is a privacy-first React web app for vocal exercise practice. It plays guided prompts, listens through the browser microphone, detects pitch locally, shows the sung pitch against target notes, and scores each attempt without uploading microphone audio.

The top-level `README.md` is user-facing. Keep implementation details, repo workflow guidance, and agent-specific process here instead of turning the README into an engineering index.

## Repository Layout

```
src/
  app/          # React app shell, controller hook, and URL-backed exercise routing
  audio/        # Browser audio capture, AudioWorklet frames, Pitchy detection, prompts
  components/   # Reusable feedback and visualization components
  domain/       # Pure music math, exercise generation, scoring, lesson state
  storage/      # Local settings and optional local clip persistence
  test/         # Shared Vitest setup
tests/browser/  # Playwright browser coverage
```

## Architecture Rules

- Domain logic belongs in `src/domain` and should stay browser-independent. Prefer pure functions with focused Vitest coverage for scoring, music math, and lesson transitions.
- Browser APIs belong behind adapters in `src/audio` or `src/storage`. Keep microphone capture, AudioWorklets, Tone.js playback, and persistence out of pure domain modules.
- The React controller in `src/app/usePitchCoachController.ts` coordinates lesson state and services. Components should receive already-shaped data rather than reimplementing scoring or audio decisions.
- No microphone audio is uploaded. Do not add network transport for audio or pitch frames unless the product explicitly changes its privacy model.
- URL routes are intentionally lightweight and live in `src/app/PitchCoachApp.tsx`. Keep route helpers aware of Vite's `import.meta.env.BASE_URL` so GitHub Pages project paths keep working.

## Product And Design Context

Pitch Coach should feel like a focused practice tool: calm, precise, and supportive. Optimize for singers who need quick feedback during repeated exercises.

- Keep the first screen as the usable exercise library, not a marketing landing page.
- Preserve clear scan paths for practice state, pitch feedback, and controls.
- Prefer compact, stable controls for repeated use.
- Keep privacy language concrete and honest.

## Commands

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm test:browser
bash scripts/validate-changes.sh --scope baseline
```

`pnpm test:browser` uses Playwright Chromium. If the browser binary is missing, run:

```bash
pnpm exec playwright install chromium
```

## Testing

- Use Vitest for pure domain logic, controller behavior, and component-level behavior.
- Use Playwright for user-facing flows such as routing, responsive practice layout, and browser-only integration behavior.
- Add tests for new exercise definitions, scoring rules, routing behavior, and persistence changes.
- If a change touches browser routing or deployment paths, run `pnpm build` and at least the relevant Playwright coverage.

## CI And Deployment

GitHub Actions workflows live under `.github/workflows/`.

- `ci.yml` runs dependency install, unit tests, production build, and Playwright browser coverage.
- `deploy-pages.yml` builds on pushes to `main` and deploys `dist/` to GitHub Pages when Pages is enabled for the repository. Private repositories must set `ENABLE_PRIVATE_PAGES_DEPLOY=true` after Pages support is available.
- The deployment workflow sets `GITHUB_PAGES=true`; `vite.config.ts` uses that to build assets under the repository base path.
- The workflow copies `dist/index.html` to `dist/404.html` so direct exercise URLs can fall back to the single-page app on GitHub Pages.

## `/create` Workflow

For end-to-end implementation requests such as `/create <prompt>` or "take this from plan to PR", use the repo-local `create-feature` skill under `.agents/skills/create-feature/`.

That workflow should inspect checkout readiness, create and maintain an implementation plan for non-trivial work, implement the change, choose tests based on the changed behavior, run deterministic local validation through `scripts/validate-changes.sh`, open a draft PR against `main`, and return any relevant deployment or preview URL.

## Implementation Plans

When starting a non-trivial feature, refactor, deployment change, or multi-step architecture change, create a Markdown plan file in `implementation-plans/` using this shape:

- `# <Title>`
- `## Goal`
- `## Approach`
- `## Affected Areas`
- `## Checklist`

Keep the checklist current while you work by marking completed steps with `- [x]`. Do not create an implementation plan for routine bug fixes, formatting-only changes, typo fixes, or narrow CI maintenance unless the user explicitly asks for one.

## Parallel Agents

Multiple AI agents may be working on this repository simultaneously. If you encounter unexpected changes, new files, or errors that you did not introduce, assume they belong to another agent or the user. Do not delete, revert, or rewrite that work unless the user explicitly asks.

## Conventions

- TypeScript is strict; keep public types explicit when it clarifies boundaries.
- Prefer existing local helper APIs and patterns before adding new abstractions.
- Keep commits conventional-style when practical, for example `feat:`, `fix:`, `docs:`, or `chore:`.
- Keep changes closely scoped to the requested behavior.
