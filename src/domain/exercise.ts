import type {
  CoachSettings,
  ExerciseDefinition,
  ScoringPolicy,
  TargetNote,
  VocalRange
} from "./contracts";
import {
  buildMajorTriad,
  clamp,
  degreeToSemitones,
  midiRange,
  midiToFrequency,
  midiToNoteName,
  parseNoteName
} from "./music";

export const MAJOR_TRIAD_EXERCISE: ExerciseDefinition = {
  id: "major-triad",
  patternDegrees: [1, 3, 5],
  startRootMidi: parseNoteName("A3"),
  stepSemitones: 1,
  direction: "up-then-down"
};

export const DEFAULT_SETTINGS: CoachSettings = {
  range: {
    lowestMidi: parseNoteName("C3"),
    highestMidi: parseNoteName("C5")
  },
  tempoBpm: 80,
  toleranceCents: 35,
  exerciseId: "major-triad",
  saveLocalClips: false,
  timingMode: "pitch-first"
};

export const DEFAULT_SCORING_POLICY: ScoringPolicy = {
  timingMode: "pitch-first",
  toleranceCents: 35,
  minVoicedCoverage: 0.6,
  maxStableSpreadCents: 45,
  noteAttackIgnoreMs: 180,
  minStableDurationMs: 300,
  stableDurationRatio: 0.4,
  timingMarginMs: 250,
  warningTimingOffsetMs: 120,
  wrongNoteCents: 65,
  maxDropoutMs: 220,
  mildWobbleCents: 32,
  scoopWarningCents: 45,
  shortSustainRatio: 0.62,
  attemptMaxDurationMs: 12000,
  finalNoteSettleMs: 260,
  noteChangeCents: 70,
  extraEventSkipCost: 32,
  missingTargetCost: 185
};

export function createScoringPolicy(settings: CoachSettings): ScoringPolicy {
  return {
    ...DEFAULT_SCORING_POLICY,
    toleranceCents: settings.toleranceCents
  };
}

export function normalizeRange(range: VocalRange): VocalRange {
  const lowestMidi = Math.round(range.lowestMidi);
  const highestMidi = Math.round(range.highestMidi);
  if (highestMidi - lowestMidi < degreeToSemitones(5)) {
    return {
      lowestMidi,
      highestMidi: lowestMidi + degreeToSemitones(5)
    };
  }

  return { lowestMidi, highestMidi };
}

export function createRootSequence(exercise: ExerciseDefinition, range: VocalRange) {
  const normalizedRange = normalizeRange(range);
  const lowestRootMidi = normalizedRange.lowestMidi;
  const highestRootMidi = normalizedRange.highestMidi - degreeToSemitones(5);
  const startRootMidi = clamp(exercise.startRootMidi, lowestRootMidi, highestRootMidi);
  const ascending = midiRange(startRootMidi, highestRootMidi);
  const descending =
    highestRootMidi - exercise.stepSemitones >= lowestRootMidi
      ? midiRange(highestRootMidi - exercise.stepSemitones, lowestRootMidi)
      : [];

  return [...ascending, ...descending];
}

export function buildTargetNotes(
  rootMidi: number,
  exercise: ExerciseDefinition,
  tempoBpm: number
): TargetNote[] {
  const beatMs = 60000 / tempoBpm;
  const triadMidis = buildMajorTriad(rootMidi, exercise.patternDegrees);

  return triadMidis.map((midi, index) => ({
    degree: exercise.patternDegrees[index],
    midi,
    label: midiToNoteName(midi),
    frequencyHz: midiToFrequency(midi),
    startMs: index * beatMs,
    endMs: (index + 1) * beatMs
  }));
}

export function getListeningDurationMs(targetNotes: TargetNote[]) {
  const lastNote = targetNotes.at(-1);
  return lastNote ? lastNote.endMs + 350 : 0;
}

export function formatExercisePattern(exercise: ExerciseDefinition) {
  return exercise.patternDegrees.join("-");
}

export function createNoteOptions(start = parseNoteName("C2"), end = parseNoteName("C6")) {
  return midiRange(start, end).map((midi) => ({
    midi,
    label: midiToNoteName(midi)
  }));
}
