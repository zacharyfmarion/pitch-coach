import { describe, expect, it } from "vitest";
import { measurePitch, summarize } from "./metrics";

describe("independent benchmark labels", () => {
  it("counts octave errors and missed notes against recall, and silent hallucinations separately", () => {
    const frequencies = [220, 440, null, 220, null];
    const frames = frequencies.map((frequencyHz, i) => ({ timeMs: 2000 + i * 100, frequencyHz, clarity: 1, rms: 1 }));
    const result = summarize(measurePitch(frames, [[0, 220], [0.1, 220], [0.2, 220], [0.3, 0], [0.4, 0]], 2000, 2500));
    expect(result.voicedFrames).toBe(3);
    expect(result.pitchRecall50Cents).toBeCloseTo(1 / 3);
    expect(result.missedVoicedRate).toBeCloseTo(1 / 3);
    expect(result.falseVoicedRate).toBe(0.5);
  });
});
