# Diagnose speaker-mode sustained-note cutoffs

## Goal

Reproduce the reported onset-only pitch trace with an audible guide, identify the failing stage, and provide a local diagnostic capture to confirm the mechanism on the user's microphone.

## Approach

Exercise the production canceller with the actual demo playback and an independently synthesized singer at the same pitch, including silence and guide-muted controls. Measure onset versus sustain separately, waveform level and pitch rejection reasons. Preserve missing detections rather than filling gaps or crediting playback. Add opt-in, numeric-only before/after diagnostics and downloadable reports; do not record or upload audio. Document confirmed synthetic evidence separately from unconfirmed real-device causation. The DSP remains unchanged until a candidate preserves singing without admitting the guide.

## Affected Areas

- `benchmarks/speaker/`: matching-guide reproduction, metrics, report
- `src/audio/`, `src/song/`: optional diagnostic transport, local UI/report
- `tests/browser/`: actual worker diagnostic data and export

## Checklist

- [x] Inspect capture, cancellation, detector gates, timeline drawing, and existing benchmarks
- [x] Reproduce onset/sustain loss with the actual demo and guide on/off controls
- [x] Save reproducible diagnostic benchmark with silence and pitch-accuracy metrics
- [x] Add opt-in before/after input levels, rejection reasons, and local numeric report
- [x] Validate diagnostics, production build, and browser integration
- [x] Update draft PR and verify preview for a real-microphone confirmation

Initial evidence: a constant same-pitch sine retains 69% of onset frames but only 5% of sustained frames with guide gain 0.35; guide muted retains 100% of both. Mean cancelled sustain RMS falls to 0.00227, below the 0.008 gate, while the microphone mix remains at 0.04649. This proves an AEC-induced failure on the synthetic fixture, not yet its exact incidence on the user's voice. The original benchmark's competing guide was two semitones higher and did not cover matching the guide.

The formal seven-case report also finds 59.8% false onset detections with no singer and the guide audible, followed by 0% during sustain. Onset traces can therefore be guide leakage. This is a diagnostic update, not a claim of repaired same-pitch cancellation. The UI states the known limitation and offers the guide-muted/headphone comparison. All 173 unit tests, production build, and 20 Chromium browser tests passed through the validation script. The browser test downloads and checks real worker/engine diagnostics. The original full vocadito evaluation was not rerun because DSP, thresholds, and scoring are unchanged; the new seven-case diagnosis ran instead.

Handoff: draft PR #17 updated. Cloudflare deployment of `e367c90` succeeded. A real Chromium visit to https://pr-17.pitch-coach.pages.dev/songs returned HTTP 200, confirmed cross-origin isolation, started the production WASM worker with diagnostics enabled, and downloaded a 19-frame numeric report with no page errors. Real-microphone confirmation from the user remains pending; no claim of a fixed cancellation algorithm is made.
