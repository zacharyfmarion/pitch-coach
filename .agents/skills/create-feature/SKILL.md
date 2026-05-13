---
name: create-feature
description: Use when the user asks to take a feature or bug fix from prompt to implementation, especially prompts like "/create a new feature", "build this feature end-to-end", "take this from plan to PR", or "own this change through validation and handoff". This skill is for repo-local delivery workflows that must create and maintain implementation plans, choose appropriate tests, run deterministic validation, and open a draft PR against main.
---

# Create Feature

Use this skill when the user wants one agent to carry a Pitch Coach repo change through planning, execution, validation, and PR handoff.

## What This Skill Owns

- Create and maintain an implementation plan for non-trivial work.
- Inspect the current checkout and make sure it is ready before editing.
- Implement the requested change directly unless a material product decision blocks progress.
- Add or update tests that match the changed behavior.
- Run local validation through the shared validation script.
- Open a draft PR against `main`.
- Return the PR URL and any relevant deployment URL when available.

## Required Reads

Before changing code, read these repo guides:

1. `AGENTS.md`
2. `.github/PULL_REQUEST_TEMPLATE.md`
3. Any relevant existing file under `implementation-plans/`

## Checkout Readiness

Do not create a worktree in this skill.

Instead:

1. Inspect checkout state with non-interactive Git commands.
2. If the repo is in a Git worktree, make sure that worktree is actually ready for development.
3. If the repo is in a normal checkout, continue in place.
4. Treat setup as a readiness check, not a separate provisioning workflow.

Default readiness expectations:

- Ensure dependencies are installed when needed with `pnpm install --frozen-lockfile`.
- Ensure Playwright Chromium is installed only when browser coverage is needed.
- Confirm the working tree contains only intended changes before committing or opening a PR.

## Planning Contract

For non-trivial work, derive a concise slug from the task and create `implementation-plans/<slug>.md`.

Use the repo's established plan format:

- `# <Title>`
- `## Goal`
- `## Approach`
- `## Affected Areas`
- `## Checklist`

Keep the checklist current while you work. Mark steps complete as soon as they are actually done using `- [x]`.

Do not create an implementation plan for narrow housekeeping work such as typo-only edits, formatting cleanup, CI fixes, or other small maintenance tasks.

## Execution Contract

After planning, implement directly unless blocked by a real product ambiguity.

Always:

- Prefer the smallest change that fully solves the task.
- Read existing patterns before introducing new ones.
- Keep domain logic pure and browser-independent.
- Keep browser APIs behind the existing app, audio, and storage boundaries.
- Preserve the privacy model: microphone audio and pitch frames stay local unless the user explicitly changes that product requirement.
- Keep URL and deployment changes compatible with Vite's `import.meta.env.BASE_URL`.
- Keep a running summary of what changed and why for the PR body.

## Test Expectations

Choose tests based on the changed behavior:

- Add or update Vitest coverage for changed music math, scoring, exercise generation, controller behavior, or route parsing.
- Add or update Playwright coverage when the change introduces or materially changes a user-facing browser flow.
- Run `pnpm build` for deployment, routing, Vite config, or bundling changes.
- If no new tests are needed, be ready to justify that in the PR.

## Validation Contract

Use `scripts/validate-changes.sh` for deterministic command execution.

Available scopes:

- `baseline`: `pnpm test` and `pnpm build`
- `e2e`: `pnpm test:browser`

Recommended usage:

```bash
bash scripts/validate-changes.sh --dry-run --changed-file src/app/PitchCoachApp.tsx
bash scripts/validate-changes.sh --scope baseline
bash scripts/validate-changes.sh --scope baseline --scope e2e
```

In your final summary and PR notes, report:

- Which validations ran
- Which validations were skipped
- Why each skipped validation was not necessary

## Pull Request Handoff

Unless the user asked otherwise, open a draft PR against `main`.

Before creating the PR:

1. Confirm the working tree contains only intended changes.
2. Fill the PR body using `.github/PULL_REQUEST_TEMPLATE.md`.
3. Include the implementation plan path in the PR notes when one was created.
4. Summarize tests added, validations run, and intentionally skipped checks.

Use `gh pr create --draft --base main`.

If `gh` auth or GitHub access is unavailable, stop after local validation and report the exact blocker.

## Deployment Handoff

Pushes to `main` deploy to GitHub Pages through `.github/workflows/deploy-pages.yml`.

After opening or merging a PR, use GitHub Actions status or the deployment environment to confirm the published site URL. Do not claim a deployment is live until GitHub reports a successful Pages deployment.

## Guardrails

- Do not create or switch worktrees from this skill.
- Do not skip the implementation plan for non-trivial work.
- Do not open the PR before required local validation succeeds.
- Do not target any base branch other than `main` unless the user explicitly says so.
- Do not add network transport for microphone audio without an explicit product decision.
