import { describe, expect, it } from "vitest";
import { createStereoBuffer } from "./audioData";
import { createSongDebugInfo, createVocalEnergyTrace } from "./debugDiagnostics";
import type { SongReference } from "./types";

describe("song debug diagnostics", () => {
  it("maps rendered note rows to both relative and original song time", () => {
    const info = createSongDebugInfo({
      reference: referenceWithNotes([
        { id: "note-0", startMs: 2000, endMs: 2600, midi: 60 },
        { id: "note-1", startMs: 15000, endMs: 15600, midi: 64 }
      ]),
      vocals: null,
      totalDurationMs: 20000,
      currentTimeMs: 2000,
      isPlaying: false,
      trimStartMs: 12000
    });

    expect(info.viewport).toEqual({ startMs: 200, endMs: 12200 });
    expect(info.visibleNotes).toHaveLength(1);
    expect(info.visibleNotes[0]).toMatchObject({
      id: "note-0",
      relativeStartMs: 2000,
      relativeEndMs: 2600,
      originalStartMs: 14000,
      originalEndMs: 14600,
      noteName: "C4"
    });
  });

  it("computes vocal stem energy locally from stereo samples", () => {
    const sampleRate = 1000;
    const left = new Float32Array([0, 0, 1, -1, 0.5, -0.5, 0, 0]);
    const right = new Float32Array(left);
    const trace = createVocalEnergyTrace(createStereoBuffer(left, right, sampleRate), 4);

    expect(trace).toHaveLength(2);
    expect(trace[0].timeMs).toBe(2);
    expect(trace[0].peak).toBe(1);
    expect(trace[0].rms).toBeCloseTo(Math.sqrt(0.5), 5);
  });
});

function referenceWithNotes(
  notes: Array<{ id: string; startMs: number; endMs: number; midi: number }>
): SongReference {
  return {
    durationMs: 20000,
    frames: [],
    notes: notes.map((note) => ({
      ...note,
      medianMidi: note.midi,
      confidence: 0.8,
      amplitude: 0.7,
      pitchBends: []
    })),
    contour: [],
    phrases: [],
    quality: { noteCount: notes.length, lowConfidenceCount: 0, suggestion: null }
  };
}
