import { describe, expect, it } from "vitest";
import type {
  AttemptHistoryRecord,
  ExerciseId,
  SegmentAssessmentStatus,
  PracticeSessionRecord
} from "./contracts";
import { EXERCISES } from "./exercise";
import { parseNoteName } from "./music";
import {
  getRecentPracticeAttempts,
  recommendPracticeExercise,
  summarizePracticeHistory,
  summarizePracticeSessions,
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
    expect(summary.segmentCount).toBe(5);
    expect(summary.segmentsInTune).toBe(4);
    expect(summary.segmentAccuracy).toBe(80);
    expect(summary.practiceMinutes).toBe(4);
    expect(summary.streakDays).toBe(3);
    expect(summary.lastPracticedAt).toBe("2026-06-10T16:00:00.000Z");
    expect(summary.weekActivity).toHaveLength(WEEK_ACTIVITY_DAYS);
    expect(summary.weekActivity.at(-1)).toMatchObject({
      date: "2026-06-10",
      attemptCount: 1,
      passedAttemptCount: 1,
      segmentCount: 2,
      segmentsInTune: 2,
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

  it("returns recent practice attempts across exercises newest first", () => {
    const records = [
      historyRecord("single-note-match", "2026-06-08T16:00:00.000Z", true, 60000, ["pass"]),
      historyRecord("major-triad", "2026-06-10T16:00:00.000Z", false, 60000, ["flat"]),
      historyRecord("five-note-scale", "2026-06-09T16:00:00.000Z", true, 60000, ["pass"])
    ];

    expect(getRecentPracticeAttempts(records, 2).map((record) => record.exerciseId)).toEqual([
      "major-triad",
      "five-note-scale"
    ]);
  });

  it("groups multiple attempts with the same session into one recent session", () => {
    const sessions = [
      sessionRecord("step-session", "step-up-back", "2026-06-10T15:00:00.000Z", "2026-06-10T15:06:00.000Z")
    ];
    const records = [
      historyRecord("step-up-back", "2026-06-10T15:05:00.000Z", true, 10000, ["pass", "pass"], "step-session"),
      historyRecord("step-up-back", "2026-06-10T15:06:00.000Z", false, 10000, ["pass", "flat"], "step-session")
    ];

    const recentSessions = summarizePracticeSessions(sessions, records);

    expect(recentSessions).toHaveLength(1);
    expect(recentSessions[0]).toMatchObject({
      id: "step-session",
      exerciseId: "step-up-back",
      attemptCount: 2,
      passedAttemptCount: 1,
      segmentCount: 4,
      segmentsInTune: 3,
      segmentAccuracy: 75,
      commonIssue: "flat"
    });
  });

  it("keeps separate sessions for the same exercise and sorts by last attempt", () => {
    const sessions = [
      sessionRecord("older-step-session", "step-up-back", "2026-06-10T15:00:00.000Z", "2026-06-10T15:04:00.000Z"),
      sessionRecord("newer-step-session", "step-up-back", "2026-06-10T16:00:00.000Z", "2026-06-10T16:03:00.000Z")
    ];
    const records = [
      historyRecord("step-up-back", "2026-06-10T15:04:00.000Z", true, 10000, ["pass"], "older-step-session"),
      historyRecord("step-up-back", "2026-06-10T16:03:00.000Z", true, 10000, ["pass"], "newer-step-session")
    ];

    expect(summarizePracticeSessions(sessions, records).map((session) => session.id)).toEqual([
      "newer-step-session",
      "older-step-session"
    ]);
  });

  it("excludes empty sessions and orphan attempts", () => {
    const sessions = [
      sessionRecord("empty-session", "major-triad", "2026-06-10T15:00:00.000Z"),
      sessionRecord("kept-session", "major-triad", "2026-06-10T16:00:00.000Z")
    ];
    const records = [
      historyRecord("major-triad", "2026-06-10T16:03:00.000Z", true, 10000, ["pass"], "kept-session"),
      historyRecord("major-triad", "2026-06-10T17:03:00.000Z", true, 10000, ["pass"], "missing-session")
    ];

    expect(summarizePracticeSessions(sessions, records).map((session) => session.id)).toEqual([
      "kept-session"
    ]);
  });
});

function historyRecord(
  exerciseId: ExerciseId,
  createdAt: string,
  passed: boolean,
  durationMs: number,
  segmentStatuses: SegmentAssessmentStatus[],
  sessionId = `${exerciseId}-session-${createdAt}`
): AttemptHistoryRecord {
  return {
    id: `${exerciseId}-${createdAt}`,
    sessionId,
    exerciseId,
    createdAt,
    rootMidi: parseNoteName("A3"),
    tempoBpm: 80,
    toleranceCents: 35,
    passed,
    summary: passed ? "Nice work." : "Try again.",
    durationMs,
    segments: segmentStatuses.map((status, index) => ({
      id: `segment-${index}`,
      kind: "note",
      label: "Root",
      shortLabel: "R",
      noteName: "A3",
      midi: parseNoteName("A3"),
      offsetSemitones: 0,
      status,
      medianCents: status === "flat" ? -42 : 0,
      stabilityCents: 8,
      warnings: []
    }))
  };
}

function sessionRecord(
  id: string,
  exerciseId: ExerciseId,
  startedAt: string,
  lastAttemptAt = startedAt
): PracticeSessionRecord {
  return {
    id,
    exerciseId,
    startedAt,
    lastAttemptAt
  };
}
