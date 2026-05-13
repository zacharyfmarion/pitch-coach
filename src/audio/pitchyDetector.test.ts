import { describe, expect, it } from "vitest";
import { PitchyPitchDetectorAdapter } from "./pitchyDetector";

describe("PitchyPitchDetectorAdapter", () => {
  it("detects a generated sine pitch", () => {
    const detector = new PitchyPitchDetectorAdapter();
    const frame = detector.detectPitch(sineWave(440), 44100, 0, {
      minFrequencyHz: 80,
      maxFrequencyHz: 1000
    });

    expect(frame.frequencyHz).not.toBeNull();
    expect(frame.frequencyHz!).toBeCloseTo(440, 0);
    expect(frame.clarity).toBeGreaterThan(0.8);
  });

  it("filters silence", () => {
    const detector = new PitchyPitchDetectorAdapter();
    const frame = detector.detectPitch(new Float32Array(4096), 44100, 0, {
      minFrequencyHz: 80,
      maxFrequencyHz: 1000
    });

    expect(frame.frequencyHz).toBeNull();
    expect(frame.rms).toBe(0);
  });
});

function sineWave(frequencyHz: number, sampleRate = 44100, length = 4096) {
  const samples = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    samples[index] = Math.sin((index / sampleRate) * frequencyHz * Math.PI * 2) * 0.7;
  }
  return samples;
}
