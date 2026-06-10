import type {
  AttemptHistoryRecord,
  AttemptScore,
  ExerciseDefinition,
  ExerciseId,
  ExerciseProgressSummary,
  NoteAssessmentStatus
} from "./contracts";
import { EXERCISES } from "./exercise";

export const ATTEMPT_HISTORY_LIMIT_PER_EXERCISE = 50;
export const RECENT_PROGRESS_ATTEMPT_COUNT = 10;
export const RECENT_ATTEMPT_DISPLAY_COUNT = 5;
export const WEEK_ACTIVITY_DAYS = 7;

export type WeekActivityBucket = {
  date: string;
  attemptCount: number;
  passedAttemptCount: number;
  durationMs: number;
};

export type PracticeSummary = {
  attemptCount: number;
  passedAttemptCount: number;
  recentPassRate?: number;
  noteCount: number;
  notesInTune: number;
  noteAccuracy?: number;
  practiceMinutes: number;
  totalDurationMs: number;
  streakDays: number;
  lastPracticedAt?: string;
  weekActivity: WeekActivityBucket[];
};

export type PracticeRecommendation = {
  exercise: ExerciseDefinition;
  reason: string;
};

type CreateAttemptHistoryRecordOptions = {
  exerciseId: ExerciseId;
  rootMidi: number;
  tempoBpm: number;
  toleranceCents: number;
  score: AttemptScore;
  createdAt?: string;
};

export function createAttemptHistoryRecord({
  exerciseId,
  rootMidi,
  tempoBpm,
  toleranceCents,
  score,
  createdAt = new Date().toISOString()
}: CreateAttemptHistoryRecordOptions): AttemptHistoryRecord {
  return {
    id: createAttemptHistoryId(exerciseId, createdAt),
    exerciseId,
    createdAt,
    rootMidi,
    tempoBpm,
    toleranceCents,
    passed: score.passed,
    summary: score.summary,
    durationMs: score.durationMs,
    notes: score.notes.map((note) => ({
      degree: note.degree,
      label: note.label,
      midi: note.midi,
      status: note.score.status,
      medianCents: note.score.medianCents,
      stabilityCents: note.score.stabilityCents,
      warnings: note.score.warnings
    }))
  };
}

export function pruneAttemptHistory(
  records: AttemptHistoryRecord[],
  limitPerExercise = ATTEMPT_HISTORY_LIMIT_PER_EXERCISE
) {
  return EXERCISES.flatMap((exercise) =>
    getRecentAttemptsForExercise(records, exercise.id, limitPerExercise)
  ).sort(compareAttemptsNewestFirst);
}

export function summarizeExerciseProgress(
  records: AttemptHistoryRecord[],
  exercises: readonly ExerciseDefinition[] = EXERCISES
): Record<ExerciseId, ExerciseProgressSummary> {
  return exercises.reduce(
    (summaries, exercise) => {
      const attempts = getRecentAttemptsForExercise(records, exercise.id, ATTEMPT_HISTORY_LIMIT_PER_EXERCISE);
      const recentAttempts = attempts.slice(0, RECENT_PROGRESS_ATTEMPT_COUNT);
      const passCount = recentAttempts.filter((attempt) => attempt.passed).length;
      summaries[exercise.id] = {
        exerciseId: exercise.id,
        attemptCount: attempts.length,
        lastPracticedAt: attempts[0]?.createdAt,
        recentPassRate:
          recentAttempts.length > 0 ? Math.round((passCount / recentAttempts.length) * 100) : undefined,
        commonIssue: findCommonIssue(recentAttempts)
      };
      return summaries;
    },
    {} as Record<ExerciseId, ExerciseProgressSummary>
  );
}

export function summarizePracticeHistory(
  records: AttemptHistoryRecord[],
  _exercises: readonly ExerciseDefinition[] = EXERCISES,
  now = new Date()
): PracticeSummary {
  const sortedRecords = [...records].sort(compareAttemptsNewestFirst);
  const recentAttempts = sortedRecords.slice(0, RECENT_PROGRESS_ATTEMPT_COUNT);
  const passedAttemptCount = records.filter((record) => record.passed).length;
  const recentPassedAttemptCount = recentAttempts.filter((record) => record.passed).length;
  const totalDurationMs = records.reduce(
    (total, record) => total + Math.max(0, record.durationMs),
    0
  );
  const noteCount = records.reduce((total, record) => total + record.notes.length, 0);
  const notesInTune = records.reduce(
    (total, record) => total + record.notes.filter(isInTuneHistoryNote).length,
    0
  );

  return {
    attemptCount: records.length,
    passedAttemptCount,
    recentPassRate:
      recentAttempts.length > 0
        ? Math.round((recentPassedAttemptCount / recentAttempts.length) * 100)
        : undefined,
    noteCount,
    notesInTune,
    noteAccuracy: noteCount > 0 ? Math.round((notesInTune / noteCount) * 100) : undefined,
    practiceMinutes:
      totalDurationMs > 0 ? Math.max(1, Math.round(totalDurationMs / 60000)) : 0,
    totalDurationMs,
    streakDays: countPracticeStreak(records, now),
    lastPracticedAt: sortedRecords[0]?.createdAt,
    weekActivity: createWeekActivity(records, now)
  };
}

export function recommendPracticeExercise(
  records: AttemptHistoryRecord[],
  exercises: readonly ExerciseDefinition[] = EXERCISES,
  fallbackExerciseId: ExerciseId = "major-triad"
): PracticeRecommendation {
  const fallbackExercise =
    exercises.find((exercise) => exercise.id === fallbackExerciseId) ?? exercises[0] ?? EXERCISES[0];
  const progressByExercise = summarizeExerciseProgress(records, exercises);

  if (records.length === 0) {
    return {
      exercise: fallbackExercise,
      reason: "Start with the selected drill and set a clean baseline."
    };
  }

  const issueCandidate = exercises
    .map((exercise) => ({
      exercise,
      progress: progressByExercise[exercise.id]
    }))
    .filter(({ progress }) => {
      const passRate = progress.recentPassRate ?? 100;
      return progress.attemptCount > 0 && (progress.commonIssue !== undefined || passRate < 75);
    })
    .sort(compareRecommendationCandidates)[0];

  if (issueCandidate) {
    return {
      exercise: issueCandidate.exercise,
      reason: createIssueRecommendationReason(issueCandidate.progress)
    };
  }

  const freshExercise = exercises.find(
    (exercise) => progressByExercise[exercise.id].attemptCount === 0
  );
  if (freshExercise) {
    return {
      exercise: freshExercise,
      reason: "Try a fresh drill while your recent attempts are steady."
    };
  }

  return {
    exercise: fallbackExercise,
    reason: "Keep this drill in rotation and build another clean streak."
  };
}

export function getRecentAttemptsForExercise(
  records: AttemptHistoryRecord[],
  exerciseId: ExerciseId,
  limit = RECENT_ATTEMPT_DISPLAY_COUNT
) {
  return records
    .filter((record) => record.exerciseId === exerciseId)
    .sort(compareAttemptsNewestFirst)
    .slice(0, limit);
}

function compareRecommendationCandidates(
  a: { progress: ExerciseProgressSummary },
  b: { progress: ExerciseProgressSummary }
) {
  const passRateDifference =
    (a.progress.recentPassRate ?? 101) - (b.progress.recentPassRate ?? 101);
  if (passRateDifference !== 0) {
    return passRateDifference;
  }

  return (
    safeTimestamp(b.progress.lastPracticedAt) -
    safeTimestamp(a.progress.lastPracticedAt)
  );
}

function createIssueRecommendationReason(progress: ExerciseProgressSummary) {
  if (progress.commonIssue) {
    return `Recent attempts are trending ${describePracticeIssue(progress.commonIssue)}.`;
  }

  return `Recent pass rate is ${progress.recentPassRate ?? 0}%.`;
}

function isInTuneHistoryNote(note: AttemptHistoryRecord["notes"][number]) {
  return note.status === "pass" || note.status === "passWithWarning";
}

function findCommonIssue(records: AttemptHistoryRecord[]) {
  const issueCounts = new Map<NoteAssessmentStatus, number>();
  records.forEach((record) => {
    record.notes.forEach((note) => {
      if (note.status === "pass" || note.status === "passWithWarning") {
        return;
      }

      issueCounts.set(note.status, (issueCounts.get(note.status) ?? 0) + 1);
    });
  });

  return [...issueCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function countPracticeStreak(records: AttemptHistoryRecord[], now: Date) {
  const practicedDays = new Set(
    records
      .map((record) => parseRecordDate(record.createdAt))
      .filter((date): date is Date => date !== null)
      .map(toLocalDateKey)
  );
  if (practicedDays.size === 0) {
    return 0;
  }

  const today = startOfLocalDay(now);
  let cursor = today;
  if (!practicedDays.has(toLocalDateKey(cursor))) {
    const yesterday = addLocalDays(today, -1);
    if (!practicedDays.has(toLocalDateKey(yesterday))) {
      return 0;
    }
    cursor = yesterday;
  }

  let streak = 0;
  while (practicedDays.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor = addLocalDays(cursor, -1);
  }
  return streak;
}

function createWeekActivity(records: AttemptHistoryRecord[], now: Date) {
  const today = startOfLocalDay(now);
  const buckets = Array.from({ length: WEEK_ACTIVITY_DAYS }, (_, index): WeekActivityBucket => {
    const date = addLocalDays(today, index - (WEEK_ACTIVITY_DAYS - 1));
    return {
      date: toLocalDateKey(date),
      attemptCount: 0,
      passedAttemptCount: 0,
      durationMs: 0
    };
  });
  const bucketsByDate = new Map(buckets.map((bucket) => [bucket.date, bucket]));

  records.forEach((record) => {
    const date = parseRecordDate(record.createdAt);
    if (!date) {
      return;
    }

    const bucket = bucketsByDate.get(toLocalDateKey(date));
    if (!bucket) {
      return;
    }

    bucket.attemptCount += 1;
    bucket.passedAttemptCount += record.passed ? 1 : 0;
    bucket.durationMs += Math.max(0, record.durationMs);
  });

  return buckets;
}

function parseRecordDate(createdAt: string) {
  const timestamp = Date.parse(createdAt);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function safeTimestamp(createdAt: string | undefined) {
  if (!createdAt) {
    return 0;
  }

  const timestamp = Date.parse(createdAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function describePracticeIssue(status: NoteAssessmentStatus) {
  switch (status) {
    case "flat":
      return "flat";
    case "sharp":
      return "sharp";
    case "wrongNote":
      return "wrong-note";
    case "unstable":
      return "unstable";
    case "unclear":
      return "unclear";
    case "missed":
      return "missed";
    case "pass":
    case "passWithWarning":
      return "in tune";
  }
}

function compareAttemptsNewestFirst(a: AttemptHistoryRecord, b: AttemptHistoryRecord) {
  const timeDifference = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  return timeDifference !== 0 ? timeDifference : b.id.localeCompare(a.id);
}

function createAttemptHistoryId(exerciseId: ExerciseId, createdAt: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${exerciseId}-${Date.parse(createdAt) || Date.now()}-${suffix}`;
}
