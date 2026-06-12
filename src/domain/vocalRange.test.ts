import { describe, expect, it } from "vitest";
import { midiToNoteName, parseNoteName } from "./music";
import {
  formatOctaveSpan,
  guessVoiceType,
  normalizeSetupRange,
  VOCAL_RANGE_MAX_MIDI,
  VOCAL_RANGE_MIN_MIDI,
  VOICE_TYPE_PRESETS
} from "./vocalRange";

describe("vocal range helpers", () => {
  it("defines the mock voice type presets", () => {
    expect(
      VOICE_TYPE_PRESETS.map((preset) => [
        preset.key,
        midiToNoteName(preset.lowestMidi),
        midiToNoteName(preset.highestMidi)
      ])
    ).toEqual([
      ["Bass", "E2", "E4"],
      ["Baritone", "G2", "G4"],
      ["Tenor", "C3", "C5"],
      ["Alto", "F3", "F5"],
      ["Mezzo", "A3", "A5"],
      ["Soprano", "C4", "C6"]
    ]);
  });

  it("guesses the closest voice type by range midpoint", () => {
    expect(guessVoiceType(parseNoteName("C3"), parseNoteName("C5"))).toBe("Tenor");
    expect(guessVoiceType(parseNoteName("A3"), parseNoteName("A5"))).toBe("Mezzo");
    expect(guessVoiceType(parseNoteName("E2"), parseNoteName("E4"))).toBe("Bass");
  });

  it("formats the range span in octaves", () => {
    expect(formatOctaveSpan(parseNoteName("C3"), parseNoteName("C5"))).toBe("2.0");
    expect(formatOctaveSpan(parseNoteName("G2"), parseNoteName("D4"))).toBe("1.6");
  });

  it("bounds setup ranges to the supported keyboard and minimum save span", () => {
    expect(normalizeSetupRange({ lowestMidi: 0, highestMidi: 1 })).toEqual({
      lowestMidi: VOCAL_RANGE_MIN_MIDI,
      highestMidi: VOCAL_RANGE_MIN_MIDI + 7
    });

    expect(normalizeSetupRange({ lowestMidi: 120, highestMidi: 121 })).toEqual({
      lowestMidi: VOCAL_RANGE_MAX_MIDI - 7,
      highestMidi: VOCAL_RANGE_MAX_MIDI
    });
  });
});
