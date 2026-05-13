export type PitchFrame = {
  timeMs: number;
  frequencyHz: number | null;
  clarity: number;
  rms: number;
};

export type ExerciseDefinition = {
  id: "major-triad";
  patternDegrees: [1, 3, 5];
  startRootMidi: number;
  stepSemitones: 1;
  direction: "up-then-down";
};

export type VocalRange = {
  lowestMidi: number;
  highestMidi: number;
};

export type CoachSettings = {
  range: VocalRange;
  tempoBpm: number;
  toleranceCents: number;
  exerciseId: ExerciseDefinition["id"];
  saveLocalClips: boolean;
  timingMode: TimingMode;
};

export type TimingMode = "pitch-first";

export type ScoringPolicy = {
  timingMode: TimingMode;
  toleranceCents: number;
  minVoicedCoverage: number;
  maxStableSpreadCents: number;
  noteAttackIgnoreMs: number;
  minStableDurationMs: number;
  stableDurationRatio: number;
  timingMarginMs: number;
  warningTimingOffsetMs: number;
  wrongNoteCents: number;
  maxDropoutMs: number;
  mildWobbleCents: number;
  scoopWarningCents: number;
  shortSustainRatio: number;
  attemptMaxDurationMs: number;
  finalNoteSettleMs: number;
  noteChangeCents: number;
  extraEventSkipCost: number;
  missingTargetCost: number;
};

export type NoteAssessmentStatus =
  | "pass"
  | "passWithWarning"
  | "flat"
  | "sharp"
  | "wrongNote"
  | "unstable"
  | "unclear"
  | "missed";

export type NoteWarning =
  | "scoop"
  | "late"
  | "early"
  | "shortSustain"
  | "mildWobble"
  | "dropout";

export type NoteAssessment = {
  status: NoteAssessmentStatus;
  medianCents?: number;
  stableStartMs?: number;
  stableEndMs?: number;
  stabilityCents?: number;
  voicedCoverage: number;
  timingOffsetMs?: number;
  warnings: NoteWarning[];
  instruction: string;
};

export type SungNoteEvent = {
  id: string;
  startMs: number;
  endMs: number;
  stableStartMs: number;
  stableEndMs: number;
  medianHz: number;
  medianMidi: number;
  stabilityCents: number;
  voicedCoverage: number;
};

export type TargetNote = {
  degree: 1 | 3 | 5;
  midi: number;
  label: string;
  frequencyHz: number;
  startMs: number;
  endMs: number;
};

export type ScoredTargetNote = TargetNote & {
  score: NoteAssessment;
  sungEvent?: SungNoteEvent;
};

export type AttemptAlignment = {
  targetIndex: number;
  target: TargetNote;
  eventIndex?: number;
  event?: SungNoteEvent;
};

export type AttemptScore = {
  passed: boolean;
  notes: ScoredTargetNote[];
  events: SungNoteEvent[];
  alignment: AttemptAlignment[];
  ignoredEventIndices: number[];
  durationMs: number;
  summary: string;
};

export type LessonStatus =
  | "idle"
  | "promptPlaying"
  | "awaitingVoice"
  | "listening"
  | "scoring"
  | "passed"
  | "retry"
  | "complete";

export type LessonState = {
  status: LessonStatus;
  rootSequence: number[];
  rootIndex: number;
  attemptNumber: number;
  lastScore?: AttemptScore;
};
