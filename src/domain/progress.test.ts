import { describe, expect, it } from "vitest";
import type { AttemptHistoryRecord, ExerciseId, NoteAssessmentStatus } from "./contracts";
import { EXERCISES } from "./exercise";
import { parseNoteName } from "./music";
import {
  recommendPracticeExercise,
  summarizePracticeHistory,
  WEEK_ACTIVITY_DAYS
} from "./progress";

describe("progress aggregation", () => {
  it("summarizes local attempts into practice stats and weekly activity", () => {
    const now = new Date(2026, 5, 10, 12);
    const records = [
      historyRecord("single-note-match", "2026-06-10T16:00:00.000Z", true, 60000, [
        "pass",
        "passWithWarning"
      ]),
      historyRecord("single-note-match", "2026-06-09T16:00:00.000Z", false, 120000, [
        "flat",
        "pass"
      ]),
      historyRecord("major-triad", "2026-06-08T16:00:00.000Z", true, 60000, ["pass"])
    ];

    const summary = summarizePracticeHistory(records, EXERCISES, now);

    expect(summary.attemptCount).toBe(3);
    expect(summary.passedAttemptCount).toBe(2);
    expect(summary.recentPassRate).toBe(67);
    expect(summary.noteCount).toBe(5);
    expect(summary.notesInTune).toBe(4);
    expect(summary.noteAccuracy).toBe(80);
    expect(summary.practiceMinutes).toBe(4);
    expect(summary.streakDays).toBe(3);
    expect(summary.lastPracticedAt).toBe("2026-06-10T16:00:00.000Z");
    expect(summary.weekActivity).toHaveLength(WEEK_ACTIVITY_DAYS);
    expect(summary.weekActivity.at(-1)).toMatchObject({
      date: "2026-06-10",
      attemptCount: 1,
      passedAttemptCount: 1,
      durationMs: 60000
    });
  });

  it("recommends the fallback drill when there is no local history", () => {
    const recommendation = recommendPracticeExercise([], EXERCISES, "major-triad");

    expect(recommendation.exercise.id).toBe("major-triad");
    expect(recommendation.reason).toMatch(/baseline/i);
  });

  it("recommends a recently struggling drill before fresh content", () => {
    const records = [
      historyRecord("single-note-match", "2026-06-10T16:00:00.000Z", true, 60000, ["pass"]),
      historyRecord("major-triad", "2026-06-09T16:00:00.000Z", false, 60000, ["flat"]),
      historyRecord("major-triad", "2026-06-08T16:00:00.000Z", false, 60000, ["flat"])
    ];

    const recommendation = recommendPracticeExercise(records, EXERCISES, "single-note-match");

    expect(recommendation.exercise.id).toBe("major-triad");
    expect(recommendation.reason).toMatch(/flat/i);
  });
});

function historyRecord(
  exerciseId: ExerciseId,
  createdAt: string,
  passed: boolean,
  durationMs: number,
  noteStatuses: NoteAssessmentStatus[]
): AttemptHistoryRecord {
  return {
    id: `${exerciseId}-${createdAt}`,
    exerciseId,
    createdAt,
    rootMidi: parseNoteName("A3"),
    tempoBpm: 80,
    toleranceCents: 35,
    passed,
    summary: passed ? "Nice work." : "Try again.",
    durationMs,
    notes: noteStatuses.map((status, index) => ({
      degree: index + 1,
      label: "A3",
      midi: parseNoteName("A3"),
      status,
      medianCents: status === "flat" ? -42 : 0,
      stabilityCents: 8,
      warnings: []
    }))
  };
}
