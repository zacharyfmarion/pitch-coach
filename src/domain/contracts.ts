export type PitchFrame = {
  timeMs: number;
  frequencyHz: number | null;
  clarity: number;
  rms: number;
};

export type ExerciseId =
  | "single-note-match"
  | "single-note-sustain"
  | "step-up-back"
  | "third-up-back"
  | "major-triad"
  | "descending-triad"
  | "five-note-scale"
  | "octave-arpeggio";

export type ExerciseCategory = "pitch" | "interval" | "arpeggio" | "scale";

export type ScoringProfile = "pitch-first" | "sustain" | "sequence";

export type PromptStyle = "sequence-only" | "chord-then-sequence";

export type ExerciseDefinition = {
  id: ExerciseId;
  title: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  category: ExerciseCategory;
  focus: string;
  patternDegrees: readonly number[];
  startRootMidi: number;
  stepSemitones: number;
  direction: "up-then-down" | "ascending" | "static";
  defaultTempoBpm: number;
  scoringProfile: ScoringProfile;
  promptStyle: PromptStyle;
  noteDurationBeats?: number;
};

export type VocalRange = {
  lowestMidi: number;
  highestMidi: number;
};

export type CoachSettings = {
  range: VocalRange;
  tempoBpm: number;
  toleranceCents: number;
  exerciseId: ExerciseId;
  saveLocalClips: boolean;
  timingMode: TimingMode;
  themePreference: ThemePreference;
};

export type TimingMode = "pitch-first";

export type ThemePreference = "system" | "light" | "dark";

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
  degree: number;
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

export type AttemptHistoryNote = {
  degree: number;
  label: string;
  midi: number;
  status: NoteAssessmentStatus;
  medianCents?: number;
  stabilityCents?: number;
  warnings: NoteWarning[];
};

export type AttemptHistoryRecord = {
  id: string;
  exerciseId: ExerciseId;
  createdAt: string;
  rootMidi: number;
  tempoBpm: number;
  toleranceCents: number;
  passed: boolean;
  summary: string;
  durationMs: number;
  notes: AttemptHistoryNote[];
};

export type ExerciseProgressSummary = {
  exerciseId: ExerciseId;
  attemptCount: number;
  lastPracticedAt?: string;
  recentPassRate?: number;
  commonIssue?: NoteAssessmentStatus;
};
