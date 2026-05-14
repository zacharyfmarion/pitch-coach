import type { PitchDetectionBounds } from "../audio/types";
import type { VocalRange } from "../domain/contracts";
import { midiToFrequency, midiToNoteName, parseNoteName } from "../domain/music";
import type { SongReference } from "./types";

const MIN_SONG_MIDI = parseNoteName("C2");
const MAX_SONG_MIDI = parseNoteName("C6");
const DEFAULT_SONG_LOW_MIDI = parseNoteName("C3");
const DEFAULT_SONG_HIGH_MIDI = parseNoteName("C5");
const PRACTICE_BOUND_MARGIN_SEMITONES = 2;

export function createSongReferenceRange(userRange: VocalRange): VocalRange {
  return {
    lowestMidi: clampMidi(Math.min(userRange.lowestMidi, DEFAULT_SONG_LOW_MIDI)),
    highestMidi: clampMidi(Math.max(userRange.highestMidi, DEFAULT_SONG_HIGH_MIDI))
  };
}

export function createSongPracticePitchBounds(
  reference: SongReference,
  fallbackRange: VocalRange
): PitchDetectionBounds {
  const midis = reference.notes.flatMap((note) => [
    note.midi,
    note.medianMidi,
    ...note.pitchBends.map((bend) => bend.midi)
  ]);

  const lowestMidi =
    midis.length > 0
      ? clampMidi(Math.floor(Math.min(...midis)) - PRACTICE_BOUND_MARGIN_SEMITONES)
      : clampMidi(fallbackRange.lowestMidi);
  const highestMidi =
    midis.length > 0
      ? clampMidi(Math.ceil(Math.max(...midis)) + PRACTICE_BOUND_MARGIN_SEMITONES)
      : clampMidi(fallbackRange.highestMidi);

  return {
    minFrequencyHz: midiToFrequency(lowestMidi),
    maxFrequencyHz: midiToFrequency(Math.max(highestMidi, lowestMidi + 1))
  };
}

export function formatSongReferenceRange(range: VocalRange | undefined) {
  return range ? `${midiToNoteName(range.lowestMidi)}-${midiToNoteName(range.highestMidi)}` : "Auto";
}

function clampMidi(midi: number) {
  return Math.min(Math.max(Math.round(midi), MIN_SONG_MIDI), MAX_SONG_MIDI);
}
