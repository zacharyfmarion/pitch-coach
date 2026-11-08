# Speaker cancellation benchmark

This prototype evaluates whether local echo cancellation improves **pitch tracking** while Pitch Coach plays a backing track. It does not evaluate studio-quality vocal isolation. All microphone processing stays on the device.

Speaker mode now uses a **calibrated playback model that stays fixed while singing**, replacing the continuously adapting AEC3 processor. It addresses the onset-only failure when the singer matches the guide. The historical AEC3 evaluation and diagnosis remain below; they are not the current implementation's acceptance evidence.

## Calibrated guide-on cancellation

The same production processor is exercised by `guideBenchmark.ts` and the real browser worker. It never receives singer-only audio, target notes, f0 annotations, or simulator room parameters. Pitch windows, the 0.008 RMS / 0.66 clarity gates, and scoring remain unchanged. There is no raw-pitch fallback, held-pitch interpolation, or target-note substitution.

Before each attempt, a 3.74-second probe measures the left and right speaker paths separately. Periodic broadband training is followed by different stereo noise: an initial portion chooses a simple soft-saturation parameter, and a final unused portion validates cancellation. The model consists of that fixed memoryless speaker response and two measured 16384-sample causal impulse responses (341 ms at 48 kHz). A partitioned FFT filter subtracts predicted playback in 480-sample blocks without adding the old AEC3's 430-sample delay. Filters do not adapt during singing.

Calibration must achieve **at least 22 dB echo reduction on its unused validation segment**, have a measurable speaker return, and avoid microphone clipping. Unreliable checks stop practice; no raw signal is scored. Scoring starts after a quiet tail. Pause/resume includes a 450 ms settling interval because physical room echoes decay while the audio clock is suspended. Reports include calibration acceptance, measured reduction and estimated nonlinearity. No calibration recordings or filter coefficients are saved or uploaded.

```bash
pnpm benchmark:speakers:prepare
pnpm benchmark:speakers:guide --split development --check
pnpm benchmark:speakers:guide --split regression --check
```

Development uses vocadito recordings 1–8 plus original sustained-note fixtures. The frozen recording-regression suite uses 9–40; these recordings were evaluated previously, so this is **not a fresh held-out test**. The new guide is a same-pitch, time-aligned copy of the normalized vocal in the actual playback, deliberately creating very strong correlation. The singer is added independently after the simulated acoustic path; singer-silent controls keep the entire guide/backing mix playing. Synthetic tests additionally use independent-phase pure tones, weak/rich harmonics, vibrato, 15-cent detuning, and muted-guide controls. The simulator applies the same unknown stereo room path to calibration and practice, with independent validation samples. It adds 35/65/110 ms delays, reflections, differing channel gains, noise, and memoryless speaker distortion. The regression suite changes distortion strength from 6 to 7.3, between calibration search-grid values.

Acceptance gates, chosen on development cases before the recording-regression run:

- At least 95% **correct-pitch recall** at both onset (70–200 ms) and sustain (300–700 ms) in every accepted synthetic singing case; missing and octave-error estimates fail.
- At most 1% false detections in guide-only controls, including onset, sustain, and the full synthetic clip.
- Recorded singing recall within three percentage points of the same clean-vocal detector; at most 1% false detections when the singer is entirely silent.
- Every regular room case must pass calibration. Noisy, 200 ppm clock-drift, and severe hard-clipping stress cases must refuse calibration. Refused cases are listed separately and never counted as accurate silent frames.

The initial linear-only candidate preserved singing but produced 5.18% false detections on recorded guide-only cases, all under speaker distortion. Calibration was extended to estimate that distortion and qualify it on separate probe samples; the pitch gate was not lowered. The final development run preserves 93.24% pitch recall versus 93.29% on clean vocals, with **0/19,200 false voiced frames** in fully-silent-singer controls. All accepted synthetic cases have 100% onset and sustain pitch recall, and 0% guide-only detections. Three unsupported acoustic conditions are refused rather than scored.

### Frozen recording-regression results

32 recordings × 4 acoustic conditions × singing/silent controls = **256 evaluated cases**. All regular cases passed calibration and all recording-regression gates passed.

| Measurement | Clean singer | Previous AEC3 | Calibrated model |
| --- | ---: | ---: | ---: |
| Correct pitch within 50 cents | 90.16% | 43.18% | **90.15%** |
| Missed voiced frames | 4.21% | 42.87% | **4.22%** |
| Median pitch error among estimates | 7.16 cents | 14.67 cents | **7.15 cents** |
| Guide-only false detection | — | 0.048% | **0 / 75,564 frames** |

On annotated rests within otherwise sung recordings, false-voiced rates are 23.01% for clean audio and 23.02% after calibrated cancellation. Preserving the clean waveform also preserves the pitch detector's existing voicing/boundary errors. The zero result above refers strictly to the entirely silent-singer controls.

[Development summary](results/guide-development.json), [development cases](results/guide-development-cases.csv), [recording-regression summary](results/guide-regression.json), and [all recording-regression cases](results/guide-regression-cases.csv) retain the evidence. Commands retain complete case JSON in `.cache/speaker-benchmark/`; checked-in summaries split the cases into CSV for reviewability. Calibration counts in the reports count case evaluations sharing the same fitted room/recording calibration.

On the Apple M1 Max development host, the frozen regression run used about 0.039 seconds of compute per second of audio, with p95 processing of 0.58 ms per 10 ms block. A worst-case block took 39.15 ms while other validation work ran, and maximum one-time calibration took 479 ms. These are Node measurements, not hardware microphone-to-display latency guarantees. Calibration permits a larger bounded startup queue; active practice retains the 20-block capture limit and stops on excessive lag.

The browser limits the song mix to ±0.18 for every guide-slider setting, inside the calibration's ±0.2 validation range. Calibration itself bypasses that song gain. This avoids extrapolating a measured speaker response to much louder uploaded tracks. Benchmarks also test louder, unnormalized references as additional stress; those volumes are not a claim about the app's playback loudness.

This measures fixed simulated paths, not a universal real-room guarantee. Keep device positions and system volume fixed after calibration; restarting practice measures a new path. Guide-slider changes are included in the actual post-gain playback reference. Unmodeled or changing acoustics, arbitrary speaker distortion, Bluetooth clock behavior, and very weak singing remain limitations. Natural annotated rests inside otherwise sung recordings still have detector/window-boundary errors; fully-silent control rates must not be presented as all-frame accuracy. The browser tests separately require ≥95% recall during an actual three-second unison hold and ≤1% detections before and after the singer while the guide continues, and cover failed calibration, cancellation during setup, pause/resume, diagnostics, and mobile layout.

Implementation references: [FFT.js API and license](https://github.com/indutny/fft.js), [acoustic echo model and filtering background](https://www.mathworks.com/help/audio/ug/acoustic-echo-cancellation-aec.html). The simulated soft-saturation family is an explicit benchmark assumption; calibration validation, not that assumption, controls whether a live attempt starts.

## Historical AEC3 benchmark: reproduce

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

## Historical AEC3 browser integration and limits

The actual AudioWorklet captures microphone and the final stereo playback mix on one audio clock. A MessageChannel feeds bounded 10 ms blocks to a worker; overload stops practice with an actionable message instead of accumulating stale feedback. Playback includes the current guide gain. Pitch window timestamps compensate known algorithmic delay and browser-reported input/output latency estimates. Those estimates still require real-device calibration to establish absolute scoring alignment. Stop, permission failure, disconnected microphones, and late permission grants release resources.

Playwright checks the real WASM worker, the real AudioWorklet graph with a known acoustic mixture, the no-WebGPU generated demo, pause/resume, mode selection, and mobile layout. The browser graph is compared against sequential processing of the same waveform. A deliberately difficult sustained 220 Hz sine achieves about **56%** pitch recall versus 0% raw in that fixture, with gaps; the test preserves and documents this weakness rather than requiring an unrealistic 90%. Recorded singing has changing harmonics and is represented by the main dataset.

The **Browser** comparison mode requests native browser echo cancellation. It has not been scored by this offline benchmark: feeding a simulated signal into a Web Audio node does not exercise the browser's hardware microphone AEC. Headphone mode is the raw-input baseline.

Remaining evidence gaps: real microphones/speakers and measured room paths, moving devices, Bluetooth latency, unrelated external playback, mobile CPU budgets, and original-vocal identity ambiguity. A known playback reference is required. Next benchmark expansion should add recorded acoustic loopback pairs or measured room responses; keep a fresh evaluation split for future tuning. The prototype can be tested now without treating listening impressions as its accuracy metric.

## Sustained-note diagnosis — 2026-11-08

The reported screenshot showed short detected fragments at note onset, followed by gaps while the singer continued. The user confirmed **Speakers mode with the vocal guide audible**. A new, original synthetic fixture uses the exact generated demo, actual playback gains, a two-second calibration, and an independent singer oscillator with a different initial phase. Echo is a fixed two-tap path (65 ms × 0.65 and 70.02 ms × 0.15). Guide-on, guide-muted, weak/rich harmonic, small-detuning, and singer-silent controls all run through the production WASM class and pitch detector.

```bash
pnpm benchmark:speakers:sustain --output benchmarks/speaker/results/sustain-diagnostic.json
```

No dataset download is needed. The [full numeric report](results/sustain-diagnostic.json) separates onset (70–200 ms after each note starts) from sustain (300–700 ms), over 16 authored notes. Detection means any accepted pitch; recall requires the correct pitch within 50 cents, so octave errors and gaps fail. Silence controls report false detection rather than pitch recall. The clean isolated singer is a fixture control, not input to cancellation. Both microphone and processed diagnostic baselines use the same 0.008 RMS / 0.66 clarity gates to isolate processing effects (the original dataset's raw baseline uses 0.005).

| Case | Onset detection | Sustained detection | Sustained correct pitch |
| --- | ---: | ---: | ---: |
| Pure held tone, guide muted | 100% | 100% | 100% |
| Pure held tone matching guide | 68.8% | 5.0% | 5.0% |
| Matching guide, weak harmonics + 4-cent vibrato | 63.4% | 19.1% | 19.1% |
| Matching guide, rich harmonics + 8-cent vibrato | 97.3% | 94.4% | 86.6% |
| Pure tone 15 cents above guide | 76.8% | 28.4% | 26.6% |
| **No singer**, guide audible | **59.8% false** | 0% false | — |
| No singer, guide muted | 0% false | 0% false | — |

The matching pure tone's cancelled sustain RMS averages **0.00227**, below the **0.008** pitch gate; 95% of sustained windows fall below that gate. Muting only the guide restores 100% sustained pitch recall in this fixture. This localizes the reproduced failure to cancellation followed by the volume gate, before chart rendering. It does not establish which internal AEC3 filter/suppressor causes the attenuation. Richer harmonics help, so the pure-tone result must not be presented as a measured human success rate.

The singer-silent case also produces short onset traces from guide leakage. Thus onset fragments in a screenshot are not sufficient proof that the microphone initially tracked the singer. The existing guide-shifted dataset and aggregate whole-excerpt metrics missed both aspects of this same-pitch case. Future fixes must preserve sustained matching-pitch singing **and** reject guide-only onsets. Simply lowering the gate, drawing through gaps, or falling back to raw microphone pitch would risk crediting playback.

### Confirm on a real microphone

In Speakers mode, enable **Debug microphone** before starting. Remain silent for the first few notes, hold a vowel while following the guide, then mute **Guide** halfway through. Stop and **Download input report**. The graph compares input and cancelled RMS; the report includes per-window input/cancelled pitch, RMS, clarity, rejection reason, guide gain, processing/queue time, and browser-reported processing settings. The microphone signal includes speaker leakage and is not singer ground truth. OS processing before capture is not observable. Paired input/processed window centers differ by the recorded 8.96 ms AEC delay; each timestamp is retained explicitly.

Diagnostics are opt-in, kept only in memory (up to two minutes; truncation is reported), and explicitly downloaded as JSON. No audio samples, device IDs, device labels, song names, or uploads are included. Turning diagnostics off avoids the extra raw pitch analysis. This confirms the stage where a live signal is lost; it is not an automatic accuracy benchmark without an independent clean singer reference. That earlier diagnostic build left DSP and gates unchanged; the current calibrated replacement is described above.
