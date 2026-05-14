import type {
  CoachSettings,
  ExerciseDefinition,
  ExerciseId,
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
  title: "Major Triad",
  description: "Sing the root, third, and fifth after the guide.",
  difficulty: 3,
  category: "arpeggio",
  focus: "Triad tuning",
  patternDegrees: [1, 3, 5],
  startRootMidi: parseNoteName("A3"),
  stepSemitones: 1,
  direction: "up-then-down",
  defaultTempoBpm: 80,
  scoringProfile: "sequence",
  promptStyle: "chord-then-sequence"
};

export const EXERCISES: readonly ExerciseDefinition[] = [
  {
    id: "single-note-match",
    title: "Single Note Match",
    description: "Hear one pitch and match it cleanly.",
    difficulty: 1,
    category: "pitch",
    focus: "Pitch center",
    patternDegrees: [1],
    startRootMidi: parseNoteName("A3"),
    stepSemitones: 1,
    direction: "up-then-down",
    defaultTempoBpm: 72,
    scoringProfile: "pitch-first",
    promptStyle: "sequence-only"
  },
  {
    id: "single-note-sustain",
    title: "Single Note Sustain",
    description: "Hold one note long enough for the pitch to settle.",
    difficulty: 1,
    category: "pitch",
    focus: "Stability",
    patternDegrees: [1],
    startRootMidi: parseNoteName("A3"),
    stepSemitones: 1,
    direction: "up-then-down",
    defaultTempoBpm: 60,
    scoringProfile: "sustain",
    promptStyle: "sequence-only",
    noteDurationBeats: 3
  },
  {
    id: "step-up-back",
    title: "Step Up and Back",
    description: "Move from the root to the second and return.",
    difficulty: 2,
    category: "interval",
    focus: "Small intervals",
    patternDegrees: [1, 2, 1],
    startRootMidi: parseNoteName("A3"),
    stepSemitones: 1,
    direction: "up-then-down",
    defaultTempoBpm: 76,
    scoringProfile: "sequence",
    promptStyle: "sequence-only"
  },
  {
    id: "third-up-back",
    title: "Third Up and Back",
    description: "Find the third without overshooting the landing.",
    difficulty: 2,
    category: "interval",
    focus: "Thirds",
    patternDegrees: [1, 3, 1],
    startRootMidi: parseNoteName("A3"),
    stepSemitones: 1,
    direction: "up-then-down",
    defaultTempoBpm: 76,
    scoringProfile: "sequence",
    promptStyle: "sequence-only"
  },
  MAJOR_TRIAD_EXERCISE,
  {
    id: "descending-triad",
    title: "Descending Triad",
    description: "Start on the fifth and resolve down through the triad.",
    difficulty: 3,
    category: "arpeggio",
    focus: "Descending accuracy",
    patternDegrees: [5, 3, 1],
    startRootMidi: parseNoteName("A3"),
    stepSemitones: 1,
    direction: "up-then-down",
    defaultTempoBpm: 80,
    scoringProfile: "sequence",
    promptStyle: "chord-then-sequence"
  },
  {
    id: "five-note-scale",
    title: "Five-Note Major Scale",
    description: "Sing up and down the first five major-scale degrees.",
    difficulty: 4,
    category: "scale",
    focus: "Scale motion",
    patternDegrees: [1, 2, 3, 4, 5, 4, 3, 2, 1],
    startRootMidi: parseNoteName("A3"),
    stepSemitones: 1,
    direction: "up-then-down",
    defaultTempoBpm: 92,
    scoringProfile: "sequence",
    promptStyle: "sequence-only"
  },
  {
    id: "octave-arpeggio",
    title: "Octave Arpeggio",
    description: "Expand the triad through the octave and return.",
    difficulty: 5,
    category: "arpeggio",
    focus: "Range control",
    patternDegrees: [1, 3, 5, 8, 5, 3, 1],
    startRootMidi: parseNoteName("A3"),
    stepSemitones: 1,
    direction: "up-then-down",
    defaultTempoBpm: 84,
    scoringProfile: "sequence",
    promptStyle: "sequence-only"
  }
];

export function getExerciseById(exerciseId: ExerciseId): ExerciseDefinition {
  return EXERCISES.find((exercise) => exercise.id === exerciseId) ?? MAJOR_TRIAD_EXERCISE;
}

export function isExerciseId(value: unknown): value is ExerciseId {
  return typeof value === "string" && EXERCISES.some((exercise) => exercise.id === value);
}

export const DEFAULT_SETTINGS: CoachSettings = {
  range: {
    lowestMidi: parseNoteName("C3"),
    highestMidi: parseNoteName("C5")
  },
  tempoBpm: 80,
  toleranceCents: 35,
  exerciseId: "major-triad",
  saveLocalClips: false,
  timingMode: "pitch-first",
  themePreference: "system"
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
  const exercise = getExerciseById(settings.exerciseId);
  const policy = {
    ...DEFAULT_SCORING_POLICY,
    toleranceCents: settings.toleranceCents
  };

  if (exercise.scoringProfile === "sustain") {
    return {
      ...policy,
      minStableDurationMs: 900,
      maxStableSpreadCents: 38,
      mildWobbleCents: 28,
      attemptMaxDurationMs: 10000,
      finalNoteSettleMs: 420
    };
  }

  if (exercise.scoringProfile === "sequence") {
    return {
      ...policy,
      attemptMaxDurationMs: Math.max(
        policy.attemptMaxDurationMs,
        exercise.patternDegrees.length * (60000 / settings.tempoBpm) + 2500
      )
    };
  }

  return policy;
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
  const patternOffsets = getPatternSemitoneOffsets(exercise);
  const lowestRootMidi = normalizedRange.lowestMidi - Math.min(...patternOffsets);
  const highestRootMidi = normalizedRange.highestMidi - Math.max(...patternOffsets);
  if (highestRootMidi < lowestRootMidi) {
    return [];
  }

  const startRootMidi = clamp(exercise.startRootMidi, lowestRootMidi, highestRootMidi);
  if (exercise.direction === "static") {
    return [startRootMidi];
  }

  const ascending = midiRangeByStep(startRootMidi, highestRootMidi, exercise.stepSemitones);
  if (exercise.direction === "ascending") {
    return ascending;
  }

  const descendingStart = highestRootMidi - exercise.stepSemitones;
  const descending =
    descendingStart >= lowestRootMidi ? midiRangeByStep(descendingStart, lowestRootMidi, exercise.stepSemitones) : [];

  return [...ascending, ...descending];
}

export function buildTargetNotes(
  rootMidi: number,
  exercise: ExerciseDefinition,
  tempoBpm: number
): TargetNote[] {
  const beatMs = 60000 / tempoBpm;
  const noteDurationBeats = exercise.noteDurationBeats ?? 1;
  const noteDurationMs = beatMs * noteDurationBeats;
  const triadMidis = buildMajorTriad(rootMidi, exercise.patternDegrees);

  return triadMidis.map((midi, index) => ({
    degree: exercise.patternDegrees[index],
    midi,
    label: midiToNoteName(midi),
    frequencyHz: midiToFrequency(midi),
    startMs: index * noteDurationMs,
    endMs: (index + 1) * noteDurationMs
  }));
}

export function getListeningDurationMs(targetNotes: TargetNote[]) {
  const lastNote = targetNotes.at(-1);
  return lastNote ? lastNote.endMs + 350 : 0;
}

export function formatExercisePattern(exercise: ExerciseDefinition) {
  return exercise.patternDegrees.join("-");
}

function getPatternSemitoneOffsets(exercise: ExerciseDefinition) {
  return exercise.patternDegrees.map(degreeToSemitones);
}

function midiRangeByStep(startMidi: number, endMidi: number, stepSemitones: number) {
  const step = Math.max(1, Math.round(stepSemitones));
  const direction = startMidi <= endMidi ? 1 : -1;
  const notes: number[] = [];
  for (
    let midi = startMidi;
    direction > 0 ? midi <= endMidi : midi >= endMidi;
    midi += direction * step
  ) {
    notes.push(midi);
  }
  return notes;
}

export function createNoteOptions(start = parseNoteName("C2"), end = parseNoteName("C6")) {
  return midiRange(start, end).map((midi) => ({
    midi,
    label: midiToNoteName(midi)
  }));
}
