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
    expect(targets.map((note) => midiToNoteName(note.midi))).toEqual(["A3", "C#4", "E4"]);
    expect(targets[1].startMs).toBe(750);
    expect(targets[2].endMs).toBe(2250);
  });

  it("keeps the exercise catalog ordered from easiest to hardest", () => {
    expect(EXERCISES.map((exercise) => exercise.difficulty)).toEqual(
      [...EXERCISES].map((exercise) => exercise.difficulty).sort((a, b) => a - b)
    );
    expect(EXERCISES[0].id).toBe("single-note-match");
    expect(EXERCISES.at(-1)?.id).toBe("octave-arpeggio");
  });

  it("builds scale and sustain exercise targets from the same generator", () => {
    const scale = buildTargetNotes(parseNoteName("A3"), getExerciseById("five-note-scale"), 120);
    expect(scale.map((note) => midiToNoteName(note.midi))).toEqual([
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

  it("uses chord prompts only for exercises that benefit from harmonic context", () => {
    expect(getExerciseById("major-triad").promptStyle).toBe("chord-then-sequence");
    expect(getExerciseById("descending-triad").promptStyle).toBe("chord-then-sequence");
    expect(getExerciseById("five-note-scale").promptStyle).toBe("sequence-only");
    expect(getExerciseById("step-up-back").promptStyle).toBe("sequence-only");
  });
});
