# Pitch Coach

A privacy-first web MVP for vocal exercise practice. The app plays a major triad prompt, listens for the sing-back, draws detected pitch against target notes, scores each note, retries missed attempts, and advances by half step after a pass.

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

No microphone audio is saved or uploaded. The app stores only local settings such as range, tempo, and tolerance.
