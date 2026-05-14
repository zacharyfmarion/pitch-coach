import { describe, expect, it } from "vitest";
import type { PitchFrame } from "../domain/contracts";
import { midiToFrequency } from "../domain/music";
import { scoreSongAttempt } from "./songScoring";
import type { SongReference } from "./types";

describe("song scoring", () => {
  it("scores an in-tune sung contour", () => {
    const score = scoreSongAttempt(referenceLine(), liveLine(0), 35);

    expect(score.tunedRatio).toBe(1);
    expect(score.regions).toHaveLength(1);
    expect(score.regions[0].status).toBe("inTune");
  });

  it("flags flat and sharp regions against the reference", () => {
    const flat = scoreSongAttempt(referenceLine(), liveLine(-52), 35);
    const sharp = scoreSongAttempt(referenceLine(), liveLine(48), 35);

    expect(flat.regions[0].status).toBe("flat");
    expect(flat.summary).toMatch(/flat/i);
    expect(sharp.regions[0].status).toBe("sharp");
    expect(sharp.summary).toMatch(/sharp/i);
  });

  it("distinguishes missed vocal sections from unclear audible pitch", () => {
    const missed = scoreSongAttempt(referenceLine(), [], 35);
    const unclear = scoreSongAttempt(
      referenceLine(),
      referenceLine().frames.map((frame) => ({
        timeMs: frame.timeMs,
        frequencyHz: null,
        clarity: 0.1,
        rms: 0.04
      })),
      35
    );

    expect(missed.regions[0].status).toBe("missed");
    expect(unclear.regions[0].status).toBe("unclear");
  });

  it("starts a new region after a long gap", () => {
    const reference: SongReference = {
      durationMs: 1600,
      phrases: [],
      frames: [
        referenceFrame(0, 60),
        referenceFrame(100, 60),
        referenceFrame(1000, 62),
        referenceFrame(1100, 62)
      ]
    };

    const score = scoreSongAttempt(
      reference,
      [
        liveFrame(0, 60),
        liveFrame(100, 60),
        liveFrame(1000, 61.4),
        liveFrame(1100, 61.4)
      ],
      35
    );

    expect(score.regions.map((region) => region.status)).toEqual(["inTune", "flat"]);
  });
});

function referenceLine(): SongReference {
  return {
    durationMs: 1200,
    phrases: [],
    frames: [0, 100, 200, 300, 400, 500].map((timeMs) => referenceFrame(timeMs, 60))
  };
}

function liveLine(offsetCents: number): PitchFrame[] {
  return referenceLine().frames.map((frame) => ({
    timeMs: frame.timeMs,
    frequencyHz: midiToFrequency(frame.midi! + offsetCents / 100),
    clarity: 0.94,
    rms: 0.08
  }));
}

function referenceFrame(timeMs: number, midi: number) {
  return {
    timeMs,
    frequencyHz: midiToFrequency(midi),
    midi,
    clarity: 0.95,
    rms: 0.08
  };
}

function liveFrame(timeMs: number, midi: number): PitchFrame {
  return {
    timeMs,
    frequencyHz: midiToFrequency(midi),
    clarity: 0.95,
    rms: 0.08
  };
}
