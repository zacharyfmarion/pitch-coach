# Preserve held notes with the guide playing

## Goal

Make speaker-mode cancellation preserve sustained singing at the guide's pitch while rejecting guide-only playback, with reproducible acceptance gates and a verified browser preview.

## Approach

The current continuously adapting speech canceller suppresses held matching-pitch voices. Measure each speaker-to-microphone path and a simple soft-saturation response during a quiet setup probe, validate on unused probe samples, then freeze the model while singing. Subtract only the predicted playback waveform; never fall back to raw pitch or fill missing notes. Reject unreliable calibration and test against playback-only controls. Keep the previous AEC3 implementation as a benchmark comparator.

Benchmarks must use the same calibration and streaming implementation as the browser, without access to clean singing, f0 labels, or simulated room parameters. Include exact-unison held tones, detuning, harmonics/vibrato, guide-only onset/sustain controls, multiple stereo echo paths, and real vocadito vocals with same-pitch guides. Report onset and sustain separately, false voiced frames, pitch error, and runtime. Freeze development settings before the recording-disjoint evaluation; the old held-out split has already been used and is a regression set, not fresh evidence.

## Affected Areas

- `src/audio/`: calibration probe, echo estimation, streaming subtraction, guardrails
- `src/song/`: quiet calibration lifecycle, status and diagnostics
- `benchmarks/speaker/`: guide-on acceptance cases, previous-processor comparison, reproducible results
- Unit and browser coverage; dependency/runtime assets if needed

## Checklist

- [x] Read workflow, existing failure evidence, audio path, and benchmark implementation
- [x] Prototype and verify calibrated cancellation on deterministic guide-on controls
- [x] Expand and run development/recording-regression benchmarks with frozen acceptance gates
- [x] Integrate validated calibration and cancellation in the browser
- [x] Cover calibration failures, held-note preservation, guide-only rejection, and lifecycle
- [x] Run deterministic validation and inspect browser behavior
- [ ] Update draft PR and verify deployed preview for user testing

The linear-only development candidate failed the guide-only requirement under soft speaker distortion (5.18% aggregate false voiced frames). The replacement also estimates a fixed soft-saturation parameter from calibration, then qualifies the response on an unused validation portion with a 22 dB minimum reduction. The successful development run has 93.24% recorded pitch recall versus 93.29% clean, zero false voiced frames in 19,200 singer-silent frames, and 100% onset/sustain recall on accepted synthetic cases. Noisy, clock-drifting, and hard-clipped probes are refused. Parameters are frozen for recording regression on 9–40, including a different nonlinearity strength. No user microphone data is part of the public benchmark.

Frozen regression: all 256 cases passed calibration; pitch recall 90.15% versus 90.16% clean and 43.18% previous AEC3; zero guide-only false detections in 75,564 frames. Natural-rest false detections remain essentially equal to the clean detector (23.02% vs 23.01%). Results and per-case CSVs are checked in. Browser playback stays within the measured probe amplitude range, including all guide-slider settings; the benchmark also tests louder references as extra stress.

Validation: 178 unit tests, production build, and 21 Chromium tests passed through `scripts/validate-changes.sh`, with `NODE_OPTIONS=--no-experimental-webstorage` for this Node 26 host. Changed files pass ESLint; the pre-existing full-repo Card import warnings remain outside this change. The real browser graph tests a three-second unison hold and guide-only periods, calibration refusal, stop during calibration, successful startup, pause/resume, numeric reports, and mobile geometry. No required validation scope skipped. The historical AEC3-only dataset command was not rerun: that implementation remains a comparator, while the new guide-on suites directly test the replacement.
