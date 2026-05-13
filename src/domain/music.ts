const NOTE_NAMES_SHARP = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B"
];

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11
};

export const A4_MIDI = 69;
export const A4_FREQUENCY_HZ = 440;

export function midiToFrequency(midi: number, tuningHz = A4_FREQUENCY_HZ) {
  return tuningHz * 2 ** ((midi - A4_MIDI) / 12);
}

export function frequencyToMidi(frequencyHz: number, tuningHz = A4_FREQUENCY_HZ) {
  return A4_MIDI + 12 * Math.log2(frequencyHz / tuningHz);
}

export function centsError(detectedHz: number, targetHz: number) {
  return 1200 * Math.log2(detectedHz / targetHz);
}

export function midiToNoteName(midi: number) {
  const rounded = Math.round(midi);
  const pitchClass = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES_SHARP[pitchClass]}${octave}`;
}

export function parseNoteName(noteName: string) {
  const match = noteName.trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!match) {
    throw new Error(`Invalid note name: ${noteName}`);
  }

  const [, rawLetter, accidental, rawOctave] = match;
  const pitchName = `${rawLetter.toUpperCase()}${accidental}`;
  const semitone = NOTE_TO_SEMITONE[pitchName];
  if (semitone === undefined) {
    throw new Error(`Invalid pitch name: ${noteName}`);
  }

  return (Number(rawOctave) + 1) * 12 + semitone;
}

export function degreeToSemitones(degree: 1 | 3 | 5) {
  switch (degree) {
    case 1:
      return 0;
    case 3:
      return 4;
    case 5:
      return 7;
  }
}

export function buildMajorTriad(rootMidi: number, degrees: readonly (1 | 3 | 5)[]) {
  return degrees.map((degree) => rootMidi + degreeToSemitones(degree));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function midiRange(startMidi: number, endMidi: number) {
  const direction = startMidi <= endMidi ? 1 : -1;
  const notes: number[] = [];
  for (let midi = startMidi; direction > 0 ? midi <= endMidi : midi >= endMidi; midi += direction) {
    notes.push(midi);
  }
  return notes;
}
