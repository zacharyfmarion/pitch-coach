# Repo Bootstrap And Deployment

## Goal

Add repo-local agent guidance and a create-feature workflow modeled after the Cascade and OpenSCAD Studio repositories, then publish Pitch Coach to a new private GitHub repository with automated deployment.

## Approach

1. Review the reference repository AGENTS and create-feature skill patterns.
2. Add Pitch Coach-specific `AGENTS.md`, `.agents/skills/create-feature/`, validation helper, and pull request template.
3. Add GitHub Actions for CI and GitHub Pages deployment.
4. Make the Vite build and app router work from the GitHub Pages project base path.
5. Validate locally, create a private GitHub repository with `gh`, push the code, and enable Pages deployment.

## Affected Areas

- `AGENTS.md`
- `.agents/skills/create-feature/`
- `.github/`
- `scripts/validate-changes.sh`
- `vite.config.ts`
- `src/app/PitchCoachApp.tsx`
- `README.md`
- `package.json`

## Checklist

- [x] Review Cascade and OpenSCAD Studio guidance and skill conventions
- [x] Add repo-local AGENTS guidance and create-feature skill
- [x] Add validation helper and PR template
- [x] Add CI and GitHub Pages deployment workflow
- [x] Update Vite base-path handling and app routing for Pages
- [x] Update README with run, verify, and deployment notes
- [x] Run local validation
- [x] Create GitHub repo and push `main`
- [x] Make the repo public so GitHub Pages can publish
- [x] Enable Pages deployment
