import { describe, expect, it } from "vitest";
import { centsError, midiToFrequency, midiToNoteName, parseNoteName } from "./music";

describe("music math", () => {
  it("converts MIDI to frequency and note names", () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 5);
    expect(midiToFrequency(parseNoteName("A3"))).toBeCloseTo(220, 5);
    expect(midiToNoteName(parseNoteName("C#4"))).toBe("C#4");
  });

  it("computes cents error", () => {
    expect(centsError(440, 440)).toBeCloseTo(0, 5);
    expect(centsError(466.1637615, 440)).toBeCloseTo(100, 2);
    expect(centsError(415.3046976, 440)).toBeCloseTo(-100, 2);
  });

});
