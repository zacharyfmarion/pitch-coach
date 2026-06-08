import { describe, expect, it } from "vitest";
import { midiToFrequency, parseNoteName } from "../domain/music";
import {
  createSongPracticePitchBounds,
  createSongReferenceRange,
  formatSongReferenceRange
} from "./referenceRange";
import type { SongReference } from "./types";

describe("song reference range", () => {
  it("does not let a narrow exercise range drop common song vocal notes", () => {
    expect(
      createSongReferenceRange({
        lowestMidi: parseNoteName("C3"),
        highestMidi: parseNoteName("D4")
      })
    ).toEqual({
      lowestMidi: parseNoteName("C3"),
      highestMidi: parseNoteName("C5")
    });
  });

  it("keeps broader user ranges for song transcription", () => {
    expect(
      createSongReferenceRange({
        lowestMidi: parseNoteName("A2"),
        highestMidi: parseNoteName("E5")
      })
    ).toEqual({
      lowestMidi: parseNoteName("A2"),
      highestMidi: parseNoteName("E5")
    });
  });

  it("bounds song practice detection around the detected reference notes", () => {
    const bounds = createSongPracticePitchBounds(referenceWithNotes([61, 64]), {
      lowestMidi: parseNoteName("C3"),
      highestMidi: parseNoteName("D4")
    });

    expect(bounds.minFrequencyHz).toBeCloseTo(midiToFrequency(59), 5);
    expect(bounds.maxFrequencyHz).toBeCloseTo(midiToFrequency(66), 5);
  });

  it("formats the active song reference range for debugging", () => {
    expect(
      formatSongReferenceRange({
        lowestMidi: parseNoteName("C3"),
        highestMidi: parseNoteName("C5")
      })
    ).toBe("C3-C5");
  });
});

function referenceWithNotes(midis: number[]): SongReference {
  return {
    frames: [],
    notes: midis.map((midi, index) => ({
      id: `note-${index}`,
      startMs: index * 100,
      endMs: index * 100 + 80,
      midi,
      medianMidi: midi,
      confidence: 0.8,
      amplitude: 0.8,
      pitchBends: []
    })),
    contour: [],
    phrases: [],
    quality: { noteCount: midis.length, lowConfidenceCount: 0, suggestion: null },
    durationMs: 1000
  };
}
