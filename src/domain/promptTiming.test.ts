import { describe, expect, it } from "vitest";
import { buildTargetNotes, getExerciseById, MAJOR_TRIAD_EXERCISE } from "./exercise";
import {
  getGuidePlaybackFrame,
  getPromptSequenceDurationMs,
  getPromptTimeline
} from "./promptTiming";
import { parseNoteName } from "./music";

describe("prompt timing", () => {
  it("keeps chord lead-in separate from the individual note sequence", () => {
    const targets = buildTargetNotes(parseNoteName("A3"), MAJOR_TRIAD_EXERCISE, 80);
    const timeline = getPromptTimeline(targets, 80, "chord-then-sequence");

    expect(timeline.chordDurationMs).toBeCloseTo(787.5);
    expect(timeline.chordGapMs).toBeCloseTo(337.5);
    expect(timeline.sequenceLeadInMs).toBeCloseTo(1125);
    expect(timeline.sequenceDurationMs).toBe(2250);

    expect(getGuidePlaybackFrame(targets, 80, "chord-then-sequence", 0)).toEqual({
      phase: "chord",
      playheadMs: null,
      activeSegmentIndices: [0, 1, 2]
    });

    expect(
      getGuidePlaybackFrame(
        targets,
        80,
        "chord-then-sequence",
        (timeline.chordDurationMs + 1) / timeline.totalDurationMs
      )
    ).toEqual({
      phase: "gap",
      playheadMs: null,
      activeSegmentIndices: []
    });

    expect(
      getGuidePlaybackFrame(
        targets,
        80,
        "chord-then-sequence",
        timeline.sequenceLeadInMs / timeline.totalDurationMs
      )
    ).toEqual({
      phase: "sequence",
      playheadMs: 0,
      activeSegmentIndices: [0]
    });

    expect(
      getGuidePlaybackFrame(
        targets,
        80,
        "chord-then-sequence",
        (timeline.sequenceLeadInMs + 900) / timeline.totalDurationMs
      )
    ).toEqual({
      phase: "sequence",
      playheadMs: 900,
      activeSegmentIndices: [1]
    });
  });

  it("starts sequence-only prompts on the first target immediately", () => {
    const exercise = getExerciseById("single-note-match");
    const targets = buildTargetNotes(parseNoteName("A3"), exercise, exercise.defaultTempoBpm);
    const timeline = getPromptTimeline(targets, exercise.defaultTempoBpm, exercise.promptStyle);

    expect(timeline.sequenceLeadInMs).toBe(0);
    expect(timeline.sequenceDurationMs).toBe(getPromptSequenceDurationMs(targets));
    expect(getGuidePlaybackFrame(targets, exercise.defaultTempoBpm, exercise.promptStyle, 0)).toEqual({
      phase: "sequence",
      playheadMs: 0,
      activeSegmentIndices: [0]
    });
  });
});
