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
  | "minor-third-up-back"
  | "descending-fourth-return"
  | "major-triad"
  | "descending-triad"
  | "random-run-playback"
  | "five-note-scale"
  | "octave-arpeggio"
  | "fifth-glide"
  | "octave-siren";

export type ExerciseCategory = "pitch" | "interval" | "arpeggio" | "scale" | "glide";

export type ScoringProfile = "pitch-first" | "sustain" | "sequence";

export type PromptStyle = "sequence-only" | "chord-then-sequence";

export type ExercisePatternSegment =
  | {
      kind: "note";
      id: string;
      label: string;
      shortLabel: string;
      offsetSemitones: number;
      durationBeats?: number;
    }
  | {
      kind: "glide";
      id: string;
      label: string;
      shortLabel: string;
      fromOffsetSemitones: number;
      toOffsetSemitones: number;
      durationBeats: number;
      curve: "linear";
    };

export type RandomRunDifficulty = 1 | 2 | 3 | 4 | 5;

export type RandomRunConfig = {
  length: number;
  difficulty: RandomRunDifficulty;
};

export type GeneratedRandomRun = {
  seed: number;
  config: RandomRunConfig;
  offsets: number[];
  patternSegments: ExercisePatternSegment[];
};

export type AttemptHistoryGeneratedRun = {
  seed: number;
  length: number;
  difficulty: RandomRunDifficulty;
  offsets: number[];
};

export type ExerciseDefinition = {
  id: ExerciseId;
  title: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  category: ExerciseCategory;
  focus: string;
  patternSegments: readonly ExercisePatternSegment[];
  startRootMidi: number;
  stepSemitones: number;
  direction: "up-then-down" | "ascending" | "static";
  defaultTempoBpm: number;
  scoringProfile: ScoringProfile;
  promptStyle: PromptStyle;
  noteDurationBeats?: number;
  generator?: {
    kind: "random-run";
  };
};

export type VocalRange = {
  lowestMidi: number;
  highestMidi: number;
};

export type VocalRangeSetupStatus = "unseen" | "skipped" | "completed";

export type VocalRangeSetupSource = "default" | "manual" | "sing";

export type VocalRangeSetup = {
  status: VocalRangeSetupStatus;
  source: VocalRangeSetupSource;
  completedAt?: string;
  skippedAt?: string;
  lastPromptedAt?: string;
};

export type PreferredAudioInput = {
  deviceId?: string;
  label?: string;
  selectedAt?: string;
};

export type CoachSettings = {
  range: VocalRange;
  rangeSetup: VocalRangeSetup;
  defaultTempoBpm: number;
  tempoBpm: number;
  toleranceCents: number;
  exerciseId: ExerciseId;
  saveLocalClips: boolean;
  timingMode: TimingMode;
  practiceMode: PracticeMode;
  themePreference: ThemePreference;
  randomRun: RandomRunConfig;
  preferredAudioInput?: PreferredAudioInput;
};

export type TimingMode = "pitch-first";

export type PracticeMode = "auto" | "manual";

export type ThemePreference =
  | {
      mode: "system";
    }
  | {
      mode: "theme";
      themeName: string;
    };

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

export type SegmentAssessmentStatus =
  | "pass"
  | "passWithWarning"
  | "flat"
  | "sharp"
  | "wrongNote"
  | "wrongDirection"
  | "offContour"
  | "unstable"
  | "unclear"
  | "missed";

export type SegmentWarning =
  | "scoop"
  | "late"
  | "early"
  | "shortSustain"
  | "mildWobble"
  | "dropout"
  | "unevenGlide"
  | "endpointDrift";

export type SegmentAssessment = {
  status: SegmentAssessmentStatus;
  medianCents?: number;
  contourErrorCents?: number;
  startCents?: number;
  endCents?: number;
  stableStartMs?: number;
  stableEndMs?: number;
  stabilityCents?: number;
  voicedCoverage: number;
  timingOffsetMs?: number;
  warnings: SegmentWarning[];
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

export type TargetSegmentBase = {
  id: string;
  kind: "note" | "glide";
  label: string;
  shortLabel: string;
  startMs: number;
  endMs: number;
};

export type TargetNoteSegment = TargetSegmentBase & {
  kind: "note";
  offsetSemitones: number;
  midi: number;
  noteName: string;
  frequencyHz: number;
};

export type TargetGlideSegment = TargetSegmentBase & {
  kind: "glide";
  fromOffsetSemitones: number;
  toOffsetSemitones: number;
  fromMidi: number;
  toMidi: number;
  fromNoteName: string;
  toNoteName: string;
  fromFrequencyHz: number;
  toFrequencyHz: number;
  curve: "linear";
};

export type TargetSegment = TargetNoteSegment | TargetGlideSegment;

export type SungContourEvent = {
  id: string;
  startMs: number;
  endMs: number;
  fromMidi: number;
  toMidi: number;
  voicedCoverage: number;
  medianErrorCents: number;
  medianAbsErrorCents: number;
  startCents: number;
  endCents: number;
  contourSpreadCents: number;
};

export type ScoredTargetSegment = TargetSegment & {
  score: SegmentAssessment;
  sungEvent?: SungNoteEvent;
  sungContour?: SungContourEvent;
};

export type AttemptAlignment = {
  targetIndex: number;
  target: TargetSegment;
  eventIndex?: number;
  event?: SungNoteEvent;
  contourIndex?: number;
  contour?: SungContourEvent;
};

export type AttemptScore = {
  passed: boolean;
  segments: ScoredTargetSegment[];
  events: SungNoteEvent[];
  contourEvents: SungContourEvent[];
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

export type AttemptHistorySegment = {
  id: string;
  kind: TargetSegment["kind"];
  label: string;
  shortLabel: string;
  noteName?: string;
  midi?: number;
  offsetSemitones?: number;
  fromNoteName?: string;
  toNoteName?: string;
  fromMidi?: number;
  toMidi?: number;
  fromOffsetSemitones?: number;
  toOffsetSemitones?: number;
  status: SegmentAssessmentStatus;
  medianCents?: number;
  contourErrorCents?: number;
  startCents?: number;
  endCents?: number;
  stabilityCents?: number;
  warnings: SegmentWarning[];
};

export type AttemptHistoryRecord = {
  id: string;
  sessionId: string;
  exerciseId: ExerciseId;
  createdAt: string;
  rootMidi: number;
  tempoBpm: number;
  toleranceCents: number;
  passed: boolean;
  summary: string;
  durationMs: number;
  segments: AttemptHistorySegment[];
  generatedRun?: AttemptHistoryGeneratedRun;
};

export type PracticeSessionRecord = {
  id: string;
  exerciseId: ExerciseId;
  startedAt: string;
  lastAttemptAt: string;
};

export type ExerciseProgressSummary = {
  exerciseId: ExerciseId;
  attemptCount: number;
  lastPracticedAt?: string;
  recentPassRate?: number;
  commonIssue?: SegmentAssessmentStatus;
};
