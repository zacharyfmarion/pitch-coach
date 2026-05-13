import { describe, expect, it } from "vitest";
import type { PitchFrame, TargetNote } from "../domain/contracts";
import { buildTargetNotes, MAJOR_TRIAD_EXERCISE } from "../domain/exercise";
import { parseNoteName } from "../domain/music";
import { getLiveTargetSpans } from "./PitchTimeline";

const targets = buildTargetNotes(parseNoteName("A3"), MAJOR_TRIAD_EXERCISE, 80);

describe("live pitch timeline target spans", () => {
  it("keeps a sharp attack assigned to the intended target when it is still closer than the next note", () => {
    const frames = [
      ...noteFrames(targets[0], 0, 520),
      ...noteFrames(targets[1], 760, 140, 85),
      ...noteFrames(targets[1], 940, 620, 0)
    ];

    const spans = getLiveTargetSpans(frames, targets);

    expect(spans[1].startMs).toBeLessThan(900);
    expect(spans[1].endMs).toBeGreaterThanOrEqual(1500);
    expect(spans[2].startMs).toBeGreaterThan(spans[1].endMs);
  });

  it("does not advance the guide on an isolated pitch spike while holding a note", () => {
    const frames = [
      ...noteFrames(targets[0], 0, 240),
      frameFor(targets[1], 320),
      ...noteFrames(targets[0], 400, 360)
    ];

    const spans = getLiveTargetSpans(frames, targets);

    expect(spans[0].endMs).toBeGreaterThan(700);
    expect(spans[1].startMs).toBeGreaterThan(700);
  });
});

function noteFrames(target: TargetNote, startMs: number, durationMs: number, offsetCents = 0): PitchFrame[] {
  const frames: PitchFrame[] = [];
  for (let timeMs = startMs; timeMs <= startMs + durationMs; timeMs += 80) {
    frames.push(frameFor(target, timeMs, offsetCents));
  }
  return frames;
}

function frameFor(target: TargetNote, timeMs: number, offsetCents = 0): PitchFrame {
  return {
    timeMs,
    frequencyHz: target.frequencyHz * 2 ** (offsetCents / 1200),
    clarity: 0.95,
    rms: 0.08
  };
}
