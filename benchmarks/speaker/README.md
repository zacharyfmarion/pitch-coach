# Speaker cancellation benchmark

This prototype evaluates whether local echo cancellation improves **pitch tracking** while Pitch Coach plays a backing track. It does not evaluate studio-quality vocal isolation. All microphone processing stays on the device.

## Reproduce

```bash
pnpm install --frozen-lockfile
pnpm benchmark:speakers:prepare
pnpm benchmark:speakers --split development --tune
pnpm benchmark:speakers --split held-out --check
```

Preparation uses Python 3.9+ standard-library modules and downloads a 58.5 MB archive once. It verifies the published MD5 and extracts to the ignored `.cache/speaker-benchmark/` directory. Evaluation writes full JSON, including per-recording cases, to that directory. `--output <path>` overrides the destination. No user recordings are required. `--check` exits unsuccessfully if any of the six fixed prototype gates fails. Performance numbers vary with hardware and other running work; accuracy uses fixed mixtures and labels.

The checked-in [held-out summary](results/held-out.json), [all held-out cases](results/held-out-cases.csv), and [development threshold comparison](results/development-tuning.json) preserve the first evaluation. Full run JSON is split into summary JSON and case CSV here for reviewability; the command above retains both in one JSON file.

## Dataset and ground truth

- **vocadito v3**, Rachel Bittner, Katherine Pasalo, Juan José Bosch, Gabriel Meseguer Brocal, David Rubinstein (2021): https://doi.org/10.5281/zenodo.5578807. License: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The source contains 40 monophonic singing excerpts in seven languages recorded on different devices, with musician-annotated f0. Dataset audio is downloaded for evaluation, not redistributed in the application.
- Source archive MD5: `dea40fd18f14d899643c4ba221b33a46`. Each run records SHA-256 hashes of the individual WAV and f0 CSV files.
- Recordings 1–8 are development; 9–40 are held out. This is a **recording-disjoint split**, not a claim of singer-disjoint generalization. Use the first 12 seconds of each, resample PCM16 audio to 48 kHz with linear interpolation, and normalize clean vocal RMS to 0.05. No pitch labels or target notes enter the canceller.
- `fixtures.ts` creates original, seeded stereo bass/chords/percussion (`seed = recording ID × 73`). The guide-vocal case adds a resampled copy of the recording two semitones above the desired microphone vocal, including it in the playback reference. The original vocal/f0 pair remains the microphone ground truth. This is synthetic competing singing, not an independent human duet.
- Known stereo playback is passed through delayed, colored multi-tap echo paths before mixing with the clean vocal. Cases cover 35–110 ms propagation/device delays, singer-to-echo ratios +6/0/−6 dB, a longer reverberant tail, soft speaker distortion, and 200 ppm clock drift. Ratios are defined using excerpt RMS, not instantaneous note loudness. These are simulated paths, not measured room impulse responses.
- Every case includes two seconds of backing-only lead-in. The application likewise plays a two-second accompaniment preview before scoring in local speaker mode. Evaluation covers the following 12-second excerpt, including singing onsets and natural rests. The initial calibration and final one-second tail are outside the reported metric interval. There is no per-case parameter tuning or ground-truth-assisted delay estimation.

## Metrics and settings

Both paths use Pitchy, a 4096-sample window (85.3 ms) and 960-sample hop (20 ms). Timestamps refer to the window center. The raw baseline uses clarity 0.66 / RMS 0.005. Local cancellation uses the same `SpeakerCancellation` streaming class as the browser worker, with WebRTC AEC3 WASM 0.3.0, 480-sample blocks, two render channels and one microphone channel. Its fixed measured 430-sample impulse-peak delay is compensated (8.96 ms); an actual-WASM unit test checks this. The selected post-cancellation RMS threshold is 0.008, clarity 0.66. Both paths use a broad, fixed 65–1100 Hz search range.

- **Pitch recall at 50 cents:** fraction of all annotated voiced frames estimated within half a semitone. Missed estimates count as failures; octave errors also count as failures. This is not the stricter user-configurable scoring tolerance.
- **Missed voiced rate:** fraction of annotated voiced frames with no estimate.
- **False voiced rate:** fraction of annotated unvoiced frames with any pitch estimate. The fully-silent-singer control is reported separately from natural pauses in otherwise sung clips.
- **Median absolute cents:** error among voiced frames with an estimate. It must be read alongside recall, since dropping hard notes can improve this median.
- Timing includes cancellation and pitch analysis per 10 ms block. Node timings do **not** measure microphone-to-display latency or establish browser/mobile deadlines.

## Development iteration

Initial AEC3 used the existing 0.66 / 0.005 thresholds. Nine threshold pairs were compared on development recordings only. Raising the post-cancellation RMS threshold to 0.008 reduced fully-silent false detections from 3.9% to 3.1%, while equal-backing pitch recall changed from 77.3% to 76.7%. Higher clarity thresholds lost more real notes without a comparable silence benefit. These settings and the acceptance gates were fixed before running the held-out split. No model was trained or fine-tuned.

## Held-out results — 2026-11-08

32 recordings × 9 scenarios = **288 mixtures / 576 pipeline evaluations**. These are the first held-out results using the frozen settings.

| Scenario | Raw pitch recall | Local cancellation pitch recall |
| --- | ---: | ---: |
| Clean microphone, no playback | 90.6% | 90.2% |
| Backing 6 dB quieter than singer | 39.8% | 82.3% |
| Backing equal to singer | 7.4% | 70.2% |
| Backing 6 dB louder than singer | 0.5% | 51.4% |
| Reverberant path | 8.2% | 69.2% |
| Competing guide vocal | 22.9% | 59.9% |
| Nonlinear speaker | 6.4% | 70.3% |
| Clock drift | 7.6% | 64.4% |

On fully-silent-singer controls, false voiced frames fell from **40.0% to 2.3%**. On natural pauses in equal-backing sung clips they **increased from 3.5% to 15.0%**; the clean microphone baseline itself reports 25.0%. Window boundaries, voiced spillover and ambiguous/weak audio around annotated rests remain limitations. Do not present the 2.3% silent-control number as the false-positive rate for all song frames.

All fixed prototype gates passed: clean recall loses ≤3 percentage points; equal-backing recall ≥65% and improvement ≥40 points; loud-backing recall ≥40%; fully-silent false rate ≤8% and at least halved. These thresholds qualify an experimental prototype, not unrestricted speaker support.

On the recorded Apple Silicon host, cancellation plus pitch analysis used about **0.041 seconds of compute per second of audio**. Worst case p95 block processing was about **0.91 ms**, but a maximum block took **24.5 ms** while other work was running. Averages and p95 are not guarantees against occasional missed deadlines.

## Browser integration and limits

The actual AudioWorklet captures microphone and the final stereo playback mix on one audio clock. A MessageChannel feeds bounded 10 ms blocks to a worker; overload stops practice with an actionable message instead of accumulating stale feedback. Playback includes the current guide gain. Pitch window timestamps compensate known algorithmic delay and browser-reported input/output latency estimates. Those estimates still require real-device calibration to establish absolute scoring alignment. Stop, permission failure, disconnected microphones, and late permission grants release resources.

Playwright checks the real WASM worker, the real AudioWorklet graph with a known acoustic mixture, the no-WebGPU generated demo, pause/resume, mode selection, and mobile layout. The browser graph is compared against sequential processing of the same waveform. A deliberately difficult sustained 220 Hz sine achieves about **56%** pitch recall versus 0% raw in that fixture, with gaps; the test preserves and documents this weakness rather than requiring an unrealistic 90%. Recorded singing has changing harmonics and is represented by the main dataset.

The **Browser** comparison mode requests native browser echo cancellation. It has not been scored by this offline benchmark: feeding a simulated signal into a Web Audio node does not exercise the browser's hardware microphone AEC. Headphone mode is the raw-input baseline.

Remaining evidence gaps: real microphones/speakers and measured room paths, moving devices, Bluetooth latency, unrelated external playback, mobile CPU budgets, and original-vocal identity ambiguity. A known playback reference is required. Next benchmark expansion should add recorded acoustic loopback pairs or measured room responses; keep a fresh evaluation split for future tuning. The prototype can be tested now without treating listening impressions as its accuracy metric.
