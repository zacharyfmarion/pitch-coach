# First-Class Exercise Target Segments

## Goal

Replace scale-step exercise patterns with root-relative target segments that can model both discrete note drills and continuous glide or siren drills.

## Approach

Introduce segment-based exercise definitions, generate timed target segments from root-relative semitone offsets, adapt scoring/playback/timeline/UI to segment targets, and add focused glide scoring for flexible pitch-first contours.

## Affected Areas

- `src/domain/`
- `src/audio/`
- `src/components/`
- `src/app/`
- `src/storage/`
- Tests covering exercise generation, scoring, storage, UI, and browser flows

## Checklist

- [x] Define segment target types and refactor exercise catalog generation
- [x] Adapt app UI, progress, and history storage to segment metadata
- [x] Add glide prompt playback and timeline rendering
- [x] Add contour scoring for glide segments
- [x] Update unit/component/browser tests
- [x] Run baseline validation and prepare PR handoff
