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
