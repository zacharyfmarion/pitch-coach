import { describe, expect, it } from "vitest";
import {
  buildTargetNotes,
  createRootSequence,
  EXERCISES,
  getExerciseById,
  MAJOR_TRIAD_EXERCISE
} from "./exercise";
import { midiToNoteName, parseNoteName } from "./music";

describe("exercise definitions", () => {
  it("creates an up-then-down root sequence within range", () => {
    const sequence = createRootSequence(MAJOR_TRIAD_EXERCISE, {
      lowestMidi: parseNoteName("C3"),
      highestMidi: parseNoteName("C5")
    });

    expect(sequence[0]).toBe(parseNoteName("A3"));
    expect(Math.max(...sequence)).toBe(parseNoteName("F4"));
    expect(sequence.at(-1)).toBe(parseNoteName("C3"));
    expect(sequence.every((root) => root >= parseNoteName("C3") && root + 7 <= parseNoteName("C5"))).toBe(
      true
    );
  });

  it("builds timed target notes at the selected tempo", () => {
    const targets = buildTargetNotes(parseNoteName("A3"), MAJOR_TRIAD_EXERCISE, 80);
    expect(targets.map(describeTargetPitch)).toEqual(["A3", "C#4", "E4"]);
    expect(targets[1].startMs).toBe(750);
    expect(targets[2].endMs).toBe(2250);
  });

  it("keeps the exercise catalog ordered from easiest to hardest", () => {
    expect(EXERCISES.map((exercise) => exercise.difficulty)).toEqual(
      [...EXERCISES].map((exercise) => exercise.difficulty).sort((a, b) => a - b)
    );
    expect(EXERCISES[0].id).toBe("single-note-match");
    expect(EXERCISES.at(-1)?.id).toBe("octave-siren");
  });

  it("builds scale and sustain exercise targets from the same generator", () => {
    const scale = buildTargetNotes(parseNoteName("A3"), getExerciseById("five-note-scale"), 120);
    expect(scale.map(describeTargetPitch)).toEqual([
      "A3",
      "B3",
      "C#4",
      "D4",
      "E4",
      "D4",
      "C#4",
      "B3",
      "A3"
    ]);

    const sustain = buildTargetNotes(parseNoteName("A3"), getExerciseById("single-note-sustain"), 60);
    expect(sustain).toHaveLength(1);
    expect(sustain[0].endMs).toBe(3000);
  });

  it("builds minor, descending, and glide interval targets from semitone offsets", () => {
    const minorThird = buildTargetNotes(parseNoteName("A3"), getExerciseById("minor-third-up-back"), 76);
    expect(minorThird.map(describeTargetPitch)).toEqual(["A3", "C4", "A3"]);
    expect(minorThird[1]).toMatchObject({
      kind: "note",
      offsetSemitones: 3,
      shortLabel: "m3"
    });

    const descendingFourth = buildTargetNotes(parseNoteName("A3"), getExerciseById("descending-fourth-return"), 72);
    expect(descendingFourth.map(describeTargetPitch)).toEqual(["A3", "E3", "A3"]);
    expect(descendingFourth[1]).toMatchObject({
      kind: "note",
      offsetSemitones: -5,
      shortLabel: "↓P4"
    });

    const fifthGlide = buildTargetNotes(parseNoteName("A3"), getExerciseById("fifth-glide"), 60);
    expect(fifthGlide[0]).toMatchObject({
      kind: "glide",
      fromNoteName: "A3",
      toNoteName: "E4",
      fromOffsetSemitones: 0,
      toOffsetSemitones: 7,
      shortLabel: "↑P5",
      startMs: 0,
      endMs: 2000
    });
  });

  it("builds octave sirens as two continuous glide targets", () => {
    const siren = buildTargetNotes(parseNoteName("A3"), getExerciseById("octave-siren"), 60);
    expect(siren).toHaveLength(2);
    expect(siren.map(describeTargetPitch)).toEqual(["A3 to A4", "A4 to A3"]);
    expect(siren[1]).toMatchObject({
      kind: "glide",
      fromOffsetSemitones: 12,
      toOffsetSemitones: 0,
      startMs: 2000,
      endMs: 4000
    });
  });

  it("uses chord prompts only for exercises that benefit from harmonic context", () => {
    expect(getExerciseById("major-triad").promptStyle).toBe("chord-then-sequence");
    expect(getExerciseById("descending-triad").promptStyle).toBe("chord-then-sequence");
    expect(getExerciseById("five-note-scale").promptStyle).toBe("sequence-only");
    expect(getExerciseById("step-up-back").promptStyle).toBe("sequence-only");
  });
});

function describeTargetPitch(target: ReturnType<typeof buildTargetNotes>[number]) {
  return target.kind === "note"
    ? midiToNoteName(target.midi)
    : `${target.fromNoteName} to ${target.toNoteName}`;
}
