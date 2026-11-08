import { describe, expect, it, vi } from "vitest";
import { StreamingPitch } from "./streamingPitch";

describe("streaming pitch timestamps", () => {
  it("keeps centered timestamps across blocks and subtracts processing delay", () => {
    const detectPitch = vi.fn((_samples, _rate, timeMs) => ({ timeMs, frequencyHz: 220, clarity: 1, rms: 0.1 }));
    const tracker = new StreamingPitch({ detectPitch }, { minFrequencyHz: 65, maxFrequencyHz: 1100 }, 48000, 430);
    const frames = [];
    for (let i = 0; i < 20; i += 1) frames.push(...tracker.push(new Float32Array(480), 48000 + i * 480));
    expect(frames[0].timeMs).toBeCloseTo((48000 + 2048 - 430) / 48);
    expect(frames[1].timeMs - frames[0].timeMs).toBeCloseTo(20);
    expect(detectPitch).toHaveBeenCalledTimes(6);
  });
});
