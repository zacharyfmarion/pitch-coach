import { describe, expect, it } from "vitest";
import type { NoteEventTime } from "@spotify/basic-pitch";
import {
  createReferenceFromBasicPitchNotes,
  decodeBasicPitchOutputToReference
} from "./basicPitchPostProcessing";
import { interpolateReferenceMidi } from "./referenceContour";
import { SONG_REFERENCE_ANALYSIS_VERSION } from "./referenceVersion";

describe("Basic Pitch song reference post-processing", () => {
  it("maps fake Basic Pitch frames into separated repeated notes", () => {
    const output = createBasicPitchOutput([
      { startFrame: 2, endFrame: 8, midi: 60 },
      { startFrame: 18, endFrame: 24, midi: 60 }
    ]);

    const reference = decodeBasicPitchOutputToReference(output, decodeOptions());

    expect(reference.analysisVersion).toBe(SONG_REFERENCE_ANALYSIS_VERSION);
    expect(reference.notes).toHaveLength(2);
    expect(reference.notes[0].midi).toBe(60);
    expect(reference.notes[1].startMs - reference.notes[0].endMs).toBeGreaterThan(80);
  });

  it("segments legato vocal pitch changes from frame activations without onset spikes", () => {
    const output = createBasicPitchOutput([
      { startFrame: 2, endFrame: 14, midi: 60, onset: 0 },
      { startFrame: 14, endFrame: 26, midi: 62, onset: 0 }
    ]);

    const reference = decodeBasicPitchOutputToReference(output, decodeOptions());

    expect(reference.notes.map((note) => note.midi)).toEqual([60, 62]);
  });

  it("splits re-articulated same-pitch notes when an onset peak appears", () => {
    const output = createBasicPitchOutput([
      { startFrame: 2, endFrame: 14, midi: 60, onset: 0.98 },
      { startFrame: 14, endFrame: 26, midi: 60, onset: 0.98 }
    ]);

    const reference = decodeBasicPitchOutputToReference(output, decodeOptions());

    expect(reference.notes).toHaveLength(2);
    expect(reference.notes.map((note) => note.midi)).toEqual([60, 60]);
  });

  it("collapses harmonic candidates into one monophonic vocal note", () => {
    const output = createBasicPitchOutput([
      { startFrame: 2, endFrame: 22, midi: 60, amplitude: 0.8 },
      { startFrame: 2, endFrame: 22, midi: 72, amplitude: 0.5 }
    ]);

    const reference = decodeBasicPitchOutputToReference(output, decodeOptions());

    expect(reference.notes).toHaveLength(1);
    expect(reference.notes[0].midi).toBe(60);
  });

  it("smooths isolated octave glitches before note segmentation", () => {
    const output = createBasicPitchOutput([{ startFrame: 2, endFrame: 22, midi: 60, amplitude: 0.8 }]);
    output.frames[12][60 - 21] = 0.2;
    output.frames[12][72 - 21] = 0.95;

    const reference = decodeBasicPitchOutputToReference(output, decodeOptions());

    expect(reference.notes).toHaveLength(1);
    expect(reference.notes[0].midi).toBe(60);
  });

  it("does not turn low-confidence sensitive noise into note blocks", () => {
    const output = createBasicPitchOutput([{ startFrame: 10, endFrame: 24, midi: 61, amplitude: 0.72 }]);
    for (let frame = 0; frame < output.frames.length; frame += 1) {
      output.frames[frame][68 - 21] = 0.11;
    }

    const reference = decodeBasicPitchOutputToReference(output, decodeOptions({ detail: "sensitive" }));

    expect(reference.notes).toHaveLength(1);
    expect(reference.notes[0].midi).toBe(61);
  });

  it("drops very short note events", () => {
    const reference = createReferenceFromBasicPitchNotes(
      [noteEvent({ startTimeSeconds: 0, durationSeconds: 0.03, pitchMidi: 60 })],
      decodeOptions()
    );

    expect(reference.notes).toHaveLength(0);
  });

  it("preserves pitch bends for slides and vibrato", () => {
    const reference = createReferenceFromBasicPitchNotes(
      [
        noteEvent({
          startTimeSeconds: 0,
          durationSeconds: 0.6,
          pitchMidi: 60,
          pitchBends: [0, 1, 2, 1, 0, -1]
        })
      ],
      decodeOptions()
    );

    expect(reference.notes).toHaveLength(1);
    expect(reference.notes[0].pitchBends.map((bend) => bend.offsetSemitones)).toContain(2 / 3);
    expect(interpolateReferenceMidi(reference, 240)).toBeGreaterThan(60);
  });

  it("reports low-confidence note quality", () => {
    const reference = createReferenceFromBasicPitchNotes(
      [0, 1, 2, 3, 4].map((index) =>
        noteEvent({
          startTimeSeconds: index * 0.25,
          durationSeconds: 0.16,
          pitchMidi: 60 + index,
          amplitude: 0.1
        })
      ),
      decodeOptions()
    );

    expect(reference.quality.lowConfidenceCount).toBe(5);
    expect(reference.quality.suggestion).toMatch(/low confidence/i);
  });

  it("filters notes outside the singer range", () => {
    const reference = createReferenceFromBasicPitchNotes(
      [
        noteEvent({ startTimeSeconds: 0, durationSeconds: 0.2, pitchMidi: 43 }),
        noteEvent({ startTimeSeconds: 0.25, durationSeconds: 0.2, pitchMidi: 60 })
      ],
      decodeOptions({ lowestMidi: 48, highestMidi: 72 })
    );

    expect(reference.notes.map((note) => note.midi)).toEqual([60]);
  });

  it("merges same-pitch note events separated by tiny gaps", () => {
    const reference = createReferenceFromBasicPitchNotes(
      [
        noteEvent({ startTimeSeconds: 0, durationSeconds: 0.2, pitchMidi: 60 }),
        noteEvent({ startTimeSeconds: 0.25, durationSeconds: 0.2, pitchMidi: 60 })
      ],
      decodeOptions()
    );

    expect(reference.notes).toHaveLength(1);
    expect(reference.notes[0].endMs).toBeCloseTo(450, 0);
  });
});

function createBasicPitchOutput(
  notes: Array<{
    startFrame: number;
    endFrame: number;
    midi: number;
    amplitude?: number;
    onset?: number;
  }>
) {
  const frameCount = Math.max(...notes.map((note) => note.endFrame)) + 6;
  const frames = createMatrix(frameCount, 88);
  const onsets = createMatrix(frameCount, 88);
  const contours = createMatrix(frameCount, 264);

  notes.forEach((note) => {
    const pitchIndex = note.midi - 21;
    onsets[note.startFrame][pitchIndex] = note.onset ?? 0.9;
    for (let frame = note.startFrame; frame < note.endFrame; frame += 1) {
      frames[frame][pitchIndex] = note.amplitude ?? 0.8;
      contours[frame][pitchIndex * 3] = 1;
    }
  });

  return { frames, onsets, contours };
}

function noteEvent(options: Partial<NoteEventTime> & Pick<NoteEventTime, "startTimeSeconds" | "durationSeconds" | "pitchMidi">): NoteEventTime {
  return {
    amplitude: 0.8,
    ...options
  };
}

function decodeOptions(
  overrides: Partial<Parameters<typeof createReferenceFromBasicPitchNotes>[1]> = {}
): Parameters<typeof createReferenceFromBasicPitchNotes>[1] {
  return {
    durationMs: 1000,
    detail: "balanced",
    lowestMidi: 48,
    highestMidi: 72,
    ...overrides
  };
}

function createMatrix(rows: number, columns: number) {
  return Array.from({ length: rows }, () => Array.from({ length: columns }, () => 0));
}
