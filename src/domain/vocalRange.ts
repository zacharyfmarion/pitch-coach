import type { VocalRange, VocalRangeSetup } from "./contracts";
import { clamp, parseNoteName } from "./music";

export const VOCAL_RANGE_MIN_MIDI = parseNoteName("C2");
export const VOCAL_RANGE_MAX_MIDI = parseNoteName("C6");
export const VOCAL_RANGE_MIN_SPAN_SEMITONES = 7;

export type VoiceTypePreset = {
  key: string;
  lowestMidi: number;
  highestMidi: number;
};

export const VOICE_TYPE_PRESETS: readonly VoiceTypePreset[] = [
  { key: "Bass", lowestMidi: parseNoteName("E2"), highestMidi: parseNoteName("E4") },
  { key: "Baritone", lowestMidi: parseNoteName("G2"), highestMidi: parseNoteName("G4") },
  { key: "Tenor", lowestMidi: parseNoteName("C3"), highestMidi: parseNoteName("C5") },
  { key: "Alto", lowestMidi: parseNoteName("F3"), highestMidi: parseNoteName("F5") },
  { key: "Mezzo", lowestMidi: parseNoteName("A3"), highestMidi: parseNoteName("A5") },
  { key: "Soprano", lowestMidi: parseNoteName("C4"), highestMidi: parseNoteName("C6") }
];

export const DEFAULT_RANGE_SETUP: VocalRangeSetup = {
  status: "unseen",
  source: "default"
};

export function normalizeSetupRange(range: VocalRange): VocalRange {
  const lowestMidi = clamp(
    Math.round(range.lowestMidi),
    VOCAL_RANGE_MIN_MIDI,
    VOCAL_RANGE_MAX_MIDI - VOCAL_RANGE_MIN_SPAN_SEMITONES
  );
  const highestMidi = clamp(
    Math.round(range.highestMidi),
    lowestMidi + VOCAL_RANGE_MIN_SPAN_SEMITONES,
    VOCAL_RANGE_MAX_MIDI
  );

  return {
    lowestMidi,
    highestMidi
  };
}

export function guessVoiceType(lowestMidi: number, highestMidi: number) {
  const midpoint = (lowestMidi + highestMidi) / 2;
  return VOICE_TYPE_PRESETS.reduce((best, candidate) => {
    const candidateMidpoint = (candidate.lowestMidi + candidate.highestMidi) / 2;
    const bestMidpoint = (best.lowestMidi + best.highestMidi) / 2;
    return Math.abs(candidateMidpoint - midpoint) < Math.abs(bestMidpoint - midpoint)
      ? candidate
      : best;
  }, VOICE_TYPE_PRESETS[0]).key;
}

export function formatOctaveSpan(lowestMidi: number, highestMidi: number) {
  return ((highestMidi - lowestMidi) / 12).toFixed(1);
}

export function isDefaultRange(range: VocalRange, defaultRange: VocalRange) {
  return range.lowestMidi === defaultRange.lowestMidi && range.highestMidi === defaultRange.highestMidi;
}
