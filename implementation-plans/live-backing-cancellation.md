# Live Backing Track Cancellation

## Goal

Prototype browser-local speaker playback cancellation for song practice, with reproducible objective pitch benchmarks before user testing.

## Approach

Use licensed vocadito recordings and independent musician-annotated fundamental frequency as ground truth. Create seeded backing tracks, echo paths, volume ratios, silence, and guide-vocal interference cases. Compare unchanged microphone pitch tracking against WebRTC AEC3 compiled to WASM. Keep development and held-out evaluation excerpts separate, report failures as well as improvements, and distinguish simulated acoustic results from hardware latency and real-room validation. Use the same streaming processor in the benchmark and live browser path. Add an opt-in speaker prototype with cancellation status and an explicit raw/headphone baseline. Audio remains local.

## Affected Areas

- `benchmarks/` and `scripts/`: dataset preparation, streaming evaluation, metrics, reproducible results
- `src/audio/`: cancellation adapter, synchronized microphone/playback capture
- `src/song/`: practice configuration, lifecycle, latency alignment, speaker controls
- `tests/browser/`: real WASM and audio graph coverage
- `package.json`, `vite.config.ts`: dependency and runtime assets

## Checklist

- [x] Inspect checkout, workflow, existing audio architecture, and dataset license
- [x] Build deterministic dataset preparation and raw-input pitch baseline
- [x] Benchmark and iterate the cancellation processor on development cases
- [x] Freeze processor settings and evaluate held-out cases
- [x] Integrate the tested processor with speaker-mode controls and robust lifecycle handling
- [x] Add focused unit and real-browser audio coverage
- [x] Run baseline, browser, lint, and benchmark validation
- [x] Open draft PR and verify a deployed preview for user testing

Development recordings 1–8 selected RMS 0.008 with clarity 0.66: this reduced fully-silent false detections from 3.9% to 3.1%, with equal-backing pitch recall changing from 77.3% to 76.7%. Settings were frozen before evaluating recordings 9–40. Held-out equal-backing recall is 70.2% (raw 7.4%); fully-silent false detections are 2.3% (raw 40.0%). All six fixed prototype gates passed. These are simulated acoustic mixtures, not a measured live-room guarantee. Detailed methodology and limitations live in `benchmarks/speaker/README.md`.

Validation: frozen dependency install; 171 Vitest tests; production build; 20 Chromium tests; actual production-bundle worker smoke test; all changed TypeScript/JavaScript files lint clean; held-out benchmark gates passed. The host uses Node 26, so the validation script ran with `NODE_OPTIONS=--no-experimental-webstorage` to avoid its native localStorage conflicting with jsdom (CI uses Node 20). Full-repository lint still reports three pre-existing unused imports in `src/app/PitchCoachApp.tsx`, confirmed in `origin/main`; unrelated code was left intact. No real-device acoustic benchmark was run. No required validation scope was skipped.

Draft PR: https://github.com/zacharyfmarion/pitch-coach/pull/17. Cloudflare reported a successful deployment and the live https://pr-17.pitch-coach.pages.dev/songs preview passed a real browser smoke test (HTTP 200, isolation enabled, local cancellation active, no page errors). CI's first run passed unit tests and build but its `ubuntu-latest` image had moved to Ubuntu 26.04, which the pinned Playwright 1.60 cannot install on. Pinning the validation runner to supported Ubuntu 24.04 fixes that infrastructure blocker.
