# iOS Audio Session Playback

## Goal

Make Pitch Coach guide tones, range reference tones, and song-practice playback audible on real iPhones when Safari/WebKit routes Web Audio through the iOS silent/ringer audio session, while preserving the local-only audio model.

## Approach

Add a small browser-audio helper that feature-detects `navigator.audioSession` and requests an appropriate session type before Web Audio playback begins. Use `"playback"` for guide/reference tones and `"play-and-record"` for any microphone capture or song practice where playback and microphone capture happen together. Leave unsupported browsers untouched and avoid throwing from optional audio-session setup.

## Affected Areas

- `src/audio/`
- `src/components/range/RangeControls.tsx`
- `src/song/practiceEngine.ts`
- `implementation-plans/`

## Checklist

- [x] Inspect the playback surfaces and current audio service boundaries.
- [x] Add shared audio-session helpers behind `src/audio`.
- [x] Wire Tone prompts, reference tones, and song-practice playback through the helper.
- [x] Add focused unit coverage for supported and unsupported audio-session behavior.
- [x] Follow-up: switch exercise/range/input-level mic capture out of playback mode before `getUserMedia`.
- [x] Run deterministic local validation.
- [x] Open a draft PR against `main`.
