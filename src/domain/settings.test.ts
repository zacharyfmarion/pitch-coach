import { describe, expect, it } from "vitest";
import {
  DEFAULT_GUIDE_TEMPO_BPM,
  getStrictnessPresetId,
  getStrictnessToleranceCents,
  normalizeGuideTempoBpm,
  normalizePreferredAudioInput
} from "./settings";

describe("settings helpers", () => {
  it("maps tolerance cents to the closest strictness preset", () => {
    expect(getStrictnessPresetId(50)).toBe("gentle");
    expect(getStrictnessPresetId(35)).toBe("standard");
    expect(getStrictnessPresetId(22)).toBe("strict");
    expect(getStrictnessPresetId(38)).toBe("standard");
    expect(getStrictnessToleranceCents("gentle")).toBe(50);
    expect(getStrictnessToleranceCents("standard")).toBe(35);
    expect(getStrictnessToleranceCents("strict")).toBe(22);
  });

  it("normalizes guide tempos to supported whole BPM values", () => {
    expect(normalizeGuideTempoBpm(undefined)).toBe(DEFAULT_GUIDE_TEMPO_BPM);
    expect(normalizeGuideTempoBpm(70.4)).toBe(70);
    expect(normalizeGuideTempoBpm(999)).toBe(140);
    expect(normalizeGuideTempoBpm(12)).toBe(50);
    expect(normalizeGuideTempoBpm("110")).toBe(110);
  });

  it("normalizes preferred audio input metadata", () => {
    expect(normalizePreferredAudioInput(undefined)).toBeUndefined();
    expect(normalizePreferredAudioInput({})).toBeUndefined();
    expect(
      normalizePreferredAudioInput({
        deviceId: "  mic-1 ",
        label: " Built-in Microphone ",
        selectedAt: "2026-06-12T12:00:00.000Z"
      })
    ).toEqual({
      deviceId: "mic-1",
      label: "Built-in Microphone",
      selectedAt: "2026-06-12T12:00:00.000Z"
    });
  });
});
