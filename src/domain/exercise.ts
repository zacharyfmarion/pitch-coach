import type {
  CoachSettings,
  ExerciseDefinition,
  ExerciseId,
  ExercisePatternSegment,
  ScoringPolicy,
  TargetSegment,
  VocalRange
} from "./contracts";
import {
  clamp,
  midiRange,
  midiToFrequency,
  midiToNoteName,
  parseNoteName
} from "./music";
import { DEFAULT_RANGE_SETUP } from "./vocalRange";

const ROOT_SEGMENT = noteSegment("root", "Root", "R", 0);
const MAJOR_SECOND_SEGMENT = noteSegment("major-second", "Major second", "M2", 2);
const MINOR_THIRD_SEGMENT = noteSegment("minor-third", "Minor third", "m3", 3);
const MAJOR_THIRD_SEGMENT = noteSegment("major-third", "Major third", "M3", 4);
const PERFECT_FOURTH_SEGMENT = noteSegment("perfect-fourth", "Perfect fourth", "P4", 5);
const DESCENDING_FOURTH_SEGMENT = noteSegment("descending-fourth", "Perfect fourth below", "↓P4", -5);
const PERFECT_FIFTH_SEGMENT = noteSegment("perfect-fifth", "Perfect fifth", "P5", 7);
const OCTAVE_SEGMENT = noteSegment("octave", "Octave", "8ve", 12);

function noteSegment(
  id: string,
  label: string,
  shortLabel: string,
  offsetSemitones: number,
  durationBeats?: number
): ExercisePatternSegment {
  return {
    kind: "note",
    id,
    label,
    shortLabel,
    offsetSemitones,
    ...(durationBeats === undefined ? {} : { durationBeats })
  };
}

function glideSegment(
  id: string,
  label: string,
  shortLabel: string,
  fromOffsetSemitones: number,
  toOffsetSemitones: number,
  durationBeats: number
): ExercisePatternSegment {
  return {
    kind: "glide",
    id,
    label,
    shortLabel,
    fromOffsetSemitones,
    toOffsetSemitones,
    durationBeats,
    curve: "linear"
  };
}

export const MAJOR_TRIAD_EXERCISE: ExerciseDefinition = {
  id: "major-triad",
  title: "Major Triad",
  description: "Sing the root, third, and fifth after the guide.",
  difficulty: 3,
  category: "arpeggio",
  focus: "Triad tuning",
  patternSegments: [ROOT_SEGMENT, MAJOR_THIRD_SEGMENT, PERFECT_FIFTH_SEGMENT],
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
    patternSegments: [ROOT_SEGMENT],
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
    patternSegments: [noteSegment("root-sustain", "Root", "R", 0, 3)],
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
    patternSegments: [ROOT_SEGMENT, MAJOR_SECOND_SEGMENT, ROOT_SEGMENT],
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
    patternSegments: [ROOT_SEGMENT, MAJOR_THIRD_SEGMENT, ROOT_SEGMENT],
    startRootMidi: parseNoteName("A3"),
    stepSemitones: 1,
    direction: "up-then-down",
    defaultTempoBpm: 76,
    scoringProfile: "sequence",
    promptStyle: "sequence-only"
  },
  {
    id: "minor-third-up-back",
    title: "Minor Third Up and Back",
    description: "Move from the root to the minor third and return.",
    difficulty: 2,
    category: "interval",
    focus: "Minor thirds",
    patternSegments: [ROOT_SEGMENT, MINOR_THIRD_SEGMENT, ROOT_SEGMENT],
    startRootMidi: parseNoteName("A3"),
    stepSemitones: 1,
    direction: "up-then-down",
    defaultTempoBpm: 76,
    scoringProfile: "sequence",
    promptStyle: "sequence-only"
  },
  {
    id: "descending-fourth-return",
    title: "Descending Fourth Return",
    description: "Drop to the fourth below and return to the root.",
    difficulty: 3,
    category: "interval",
    focus: "Descending intervals",
    patternSegments: [ROOT_SEGMENT, DESCENDING_FOURTH_SEGMENT, ROOT_SEGMENT],
    startRootMidi: parseNoteName("A3"),
    stepSemitones: 1,
    direction: "up-then-down",
    defaultTempoBpm: 72,
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
    patternSegments: [PERFECT_FIFTH_SEGMENT, MAJOR_THIRD_SEGMENT, ROOT_SEGMENT],
    startRootMidi: parseNoteName("A3"),
    stepSemitones: 1,
    direction: "up-then-down",
    defaultTempoBpm: 80,
    scoringProfile: "sequence",
    promptStyle: "chord-then-sequence"
  },
  {
    id: "fifth-glide",
    title: "Fifth Glide",
    description: "Slide smoothly from the root up to the fifth.",
    difficulty: 3,
    category: "glide",
    focus: "Connected ascent",
    patternSegments: [glideSegment("root-to-fifth", "Root to fifth", "↑P5", 0, 7, 2)],
    startRootMidi: parseNoteName("A3"),
    stepSemitones: 1,
    direction: "up-then-down",
    defaultTempoBpm: 60,
    scoringProfile: "sequence",
    promptStyle: "sequence-only"
  },
  {
    id: "five-note-scale",
    title: "Five-Note Major Scale",
    description: "Sing up and down the first five major-scale steps.",
    difficulty: 4,
    category: "scale",
    focus: "Scale motion",
    patternSegments: [
      ROOT_SEGMENT,
      MAJOR_SECOND_SEGMENT,
      MAJOR_THIRD_SEGMENT,
      PERFECT_FOURTH_SEGMENT,
      PERFECT_FIFTH_SEGMENT,
      PERFECT_FOURTH_SEGMENT,
      MAJOR_THIRD_SEGMENT,
      MAJOR_SECOND_SEGMENT,
      ROOT_SEGMENT
    ],
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
    patternSegments: [
      ROOT_SEGMENT,
      MAJOR_THIRD_SEGMENT,
      PERFECT_FIFTH_SEGMENT,
      OCTAVE_SEGMENT,
      PERFECT_FIFTH_SEGMENT,
      MAJOR_THIRD_SEGMENT,
      ROOT_SEGMENT
    ],
    startRootMidi: parseNoteName("A3"),
    stepSemitones: 1,
    direction: "up-then-down",
    defaultTempoBpm: 84,
    scoringProfile: "sequence",
    promptStyle: "sequence-only"
  },
  {
    id: "octave-siren",
    title: "Octave Siren",
    description: "Glide up to the octave and back without breaking the line.",
    difficulty: 5,
    category: "glide",
    focus: "Range connection",
    patternSegments: [
      glideSegment("root-to-octave", "Root to octave", "↑8ve", 0, 12, 2),
      glideSegment("octave-to-root", "Octave to root", "↓8ve", 12, 0, 2)
    ],
    startRootMidi: parseNoteName("A3"),
    stepSemitones: 1,
    direction: "up-then-down",
    defaultTempoBpm: 60,
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
  rangeSetup: DEFAULT_RANGE_SETUP,
  tempoBpm: 80,
  toleranceCents: 35,
  exerciseId: "major-triad",
  saveLocalClips: false,
  timingMode: "pitch-first",
  practiceMode: "auto",
  themePreference: {
    mode: "system"
  }
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
        getExerciseDurationBeats(exercise) * (60000 / settings.tempoBpm) + 2500
      )
    };
  }

  return policy;
}

export function normalizeRange(range: VocalRange): VocalRange {
  const lowestMidi = Math.round(range.lowestMidi);
  const highestMidi = Math.round(range.highestMidi);
  if (highestMidi - lowestMidi < 7) {
    return {
      lowestMidi,
      highestMidi: lowestMidi + 7
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
): TargetSegment[] {
  const beatMs = 60000 / tempoBpm;
  let cursorMs = 0;

  return exercise.patternSegments.map((segment, index) => {
    const durationBeats =
      segment.kind === "note"
        ? segment.durationBeats ?? exercise.noteDurationBeats ?? 1
        : segment.durationBeats;
    const durationMs = beatMs * durationBeats;
    const startMs = cursorMs;
    const endMs = cursorMs + durationMs;
    cursorMs = endMs;

    if (segment.kind === "note") {
      const midi = rootMidi + segment.offsetSemitones;
      return {
        kind: "note",
        id: `${segment.id}-${index + 1}`,
        label: segment.label,
        shortLabel: segment.shortLabel,
        offsetSemitones: segment.offsetSemitones,
        midi,
        noteName: midiToNoteName(midi),
        frequencyHz: midiToFrequency(midi),
        startMs,
        endMs
      };
    }

    const fromMidi = rootMidi + segment.fromOffsetSemitones;
    const toMidi = rootMidi + segment.toOffsetSemitones;
    return {
      kind: "glide",
      id: `${segment.id}-${index + 1}`,
      label: segment.label,
      shortLabel: segment.shortLabel,
      fromOffsetSemitones: segment.fromOffsetSemitones,
      toOffsetSemitones: segment.toOffsetSemitones,
      fromMidi,
      toMidi,
      fromNoteName: midiToNoteName(fromMidi),
      toNoteName: midiToNoteName(toMidi),
      fromFrequencyHz: midiToFrequency(fromMidi),
      toFrequencyHz: midiToFrequency(toMidi),
      curve: segment.curve,
      startMs,
      endMs
    };
  });
}

export function getListeningDurationMs(targetSegments: TargetSegment[]) {
  const lastSegment = targetSegments.at(-1);
  return lastSegment ? lastSegment.endMs + 350 : 0;
}

export function formatExercisePattern(exercise: ExerciseDefinition) {
  return exercise.patternSegments.map((segment) => segment.shortLabel).join("-");
}

function getPatternSemitoneOffsets(exercise: ExerciseDefinition) {
  return exercise.patternSegments.flatMap((segment) =>
    segment.kind === "note"
      ? [segment.offsetSemitones]
      : [segment.fromOffsetSemitones, segment.toOffsetSemitones]
  );
}

function getExerciseDurationBeats(exercise: ExerciseDefinition) {
  return exercise.patternSegments.reduce((total, segment) => {
    if (segment.kind === "note") {
      return total + (segment.durationBeats ?? exercise.noteDurationBeats ?? 1);
    }

    return total + segment.durationBeats;
  }, 0);
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
