import { describe, expect, it } from "vitest";
import { createRootSequence, buildTargetNotes, MAJOR_TRIAD_EXERCISE } from "./exercise";
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
});
