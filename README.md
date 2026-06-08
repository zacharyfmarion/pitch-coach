# Pitch Coach

A privacy-first web app for vocal practice. The app plays guided exercises, listens for the sing-back, draws detected pitch against target notes, scores each note, and includes an experimental browser-local song practice mode for trimmed audio sections.

## Deployment

GitHub Actions includes CI and a Cloudflare Pages deployment workflow for `main`. The app publishes here:

https://pitch-coach.pages.dev/

Microphone input requires HTTPS or localhost. Song mode also requires WebGPU and cross-origin isolation headers so vocal isolation can run locally in the browser.

Production song mode expects `VITE_DEMUCS_MODEL_URL` to point to a CORS-enabled Demucs ONNX model, preferably hosted from Cloudflare R2. The build serves ONNX Runtime Web's browser runtime from `/ort/`, and Cloudflare Pages must deploy `public/_headers` so those assets keep the cross-origin isolation headers.

## Run

```bash
pnpm install
pnpm dev
```

## Verify

```bash
pnpm test
pnpm build
pnpm test:browser
pnpm validate:changes
```

`pnpm test:browser` uses Playwright Chromium. If the browser binary is missing, run:

```bash
pnpm exec playwright install chromium
```

## Architecture

- `src/domain`: pure music math, exercise generation, scoring, and lesson state.
- `src/audio`: browser microphone capture, AudioWorklet frame capture, Pitchy detection, and Tone.js prompt playback.
- `src/app`: React controller and app composition.
- `src/components`: reusable visual feedback components.
- `src/storage`: settings-only local persistence.
- `src/song`: browser-local upload, vocal isolation, reference pitch extraction, and song scoring.
- `.github/workflows`: CI and Cloudflare Pages deployment.

No microphone audio or uploaded song audio is uploaded. The app stores local settings such as range, tempo, and tolerance; microphone clips are saved only locally when that setting is enabled.
