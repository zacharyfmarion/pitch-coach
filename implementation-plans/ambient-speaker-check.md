# Speaker calibration in everyday room noise

## Goal

Keep sustained singing visible with the vocal guide playing when steady room sound limits broadband echo reduction.

## Approach

Fit a short stereo response on the stronger part of the probe, measure error on unused broadband samples, and freeze the pitch floor before testing separate guide notes. Test singer-silent playback and independent held pitches before enabling the room-specific setting.

## Affected Areas

Speaker calibration, song practice startup, input diagnostics, guide-on benchmarks and speaker setup instructions.

## Checklist

- [x] Reproduce the failure on the built-in microphone in Chrome Canary.
- [x] Compare alternatives on an in-memory capture with physical guide playback.
- [x] Integrate the frozen model, pitch detector and qualification checks.
- [x] Verify held notes and guide-only playback in the benchmark and browser.
- [x] Update the preview’s speaker setup instructions for a sung test.
