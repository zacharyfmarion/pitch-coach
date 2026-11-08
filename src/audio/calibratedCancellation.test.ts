import { describe, expect, it } from "vitest";
import { CalibratedCancellation, createCalibrationProbe, StereoEchoFilter } from "./calibratedCancellation";
import { PitchyPitchDetectorAdapter } from "./pitchyDetector";
import { StreamingPitch } from "./streamingPitch";
import { SPEAKER_PITCH_OPTIONS } from "./speakerCancellation";
import { speakerMixGain } from "./speakerHeadroom";

describe("calibrated playback cancellation", () => {
  it("keeps all guide-slider settings inside the calibration amplitude range", () => {
    const backing = { left: new Float32Array([0.8, -0.6, 0.1]), right: new Float32Array([-1, 0.3]) };
    const vocals = { left: new Float32Array([0.9, 0.5]), right: new Float32Array([-0.2, 0.8, 1]) };
    const gain = speakerMixGain(backing, vocals);
    for (const guide of [0, 0.35, 1]) for (const channel of ["left", "right"] as const) for (let i = 0; i < 3; i += 1) {
      expect(Math.abs(((backing[channel][i] ?? 0) * 0.95 + (vocals[channel][i] ?? 0) * guide) * gain)).toBeLessThanOrEqual(0.180001);
    }
    const quiet = { left: new Float32Array([0.01]), right: new Float32Array([0.01]) };
    expect(speakerMixGain(quiet, quiet)).toBe(1);
  });
  it("matches causal stereo convolution across partition boundaries without adding delay", () => {
    const left = new Float32Array(1100), right = new Float32Array(1100);
    left[0] = 0.5; left[479] = -0.1; left[480] = 0.3; left[1001] = 0.2; right[613] = -0.4;
    const filter = new StereoEchoFilter([left, right]);
    const input = Float32Array.from({ length: 2400 }, (_, i) => Math.sin(i * 0.07) * 0.1);
    const other = input.map((x) => x * 0.6);
    for (let start = 0; start < input.length; start += 480) {
      const actual = filter.process(input.subarray(start, start + 480), other.subarray(start, start + 480));
      for (let i = 0; i < 480; i += 1) {
        const at = start + i;
        const expected = 0.5 * input[at] - 0.1 * (input[at - 479] ?? 0) + 0.3 * (input[at - 480] ?? 0) + 0.2 * (input[at - 1001] ?? 0) - 0.4 * (other[at - 613] ?? 0);
        expect(actual[i]).toBeCloseTo(expected, 6);
      }
    }
  });

  it("preserves a matching held tone and rejects the same guide when the singer stops", () => {
    const probe = createCalibrationProbe();
    const acoustic = (l: Float32Array, r: Float32Array) => l.map((_, i) => 0.4 * (l[i - 3120] ?? 0) + 0.25 * (r[i - 3120] ?? 0) + 0.1 * (l[i - 3361] ?? 0));
    const filter = new CalibratedCancellation(acoustic(probe.left, probe.right), probe.left, probe.right);
    expect(filter.quality.accepted).toBe(true);
    const guide = Float32Array.from({ length: 48000 * 4 }, (_, i) => 0.08 * Math.sin(2 * Math.PI * 220 * i / 48000));
    const echo = acoustic(guide, guide);
    const microphone = echo.map((v, i) => v + (i >= 48000 && i < 3 * 48000 ? 0.07 * Math.sin(2 * Math.PI * 220 * i / 48000 + 1.1) : 0));
    const pitch = new StreamingPitch(new PitchyPitchDetectorAdapter(SPEAKER_PITCH_OPTIONS), { minFrequencyHz: 65, maxFrequencyHz: 1100 }, 48000);
    const frames = [];
    for (let i = 0; i < guide.length; i += 480) frames.push(...pitch.push(filter.process(microphone.subarray(i, i + 480), guide.subarray(i, i + 480), guide.subarray(i, i + 480)), i));
    const singing = frames.filter((f) => f.timeMs >= 1100 && f.timeMs < 2900);
    expect(singing.every((f) => f.frequencyHz !== null && Math.abs(1200 * Math.log2(f.frequencyHz / 220)) < 10)).toBe(true);
    const silent = frames.filter((f) => f.timeMs < 900 || f.timeMs > 3100);
    expect(silent.every((f) => f.frequencyHz === null)).toBe(true);
  });

  it("refuses independent voice/noise during calibration and never passes raw input through", () => {
    const probe = createCalibrationProbe();
    const microphone = probe.left.map((_, i) => 0.06 * Math.sin(2 * Math.PI * 220 * i / 48000));
    const filter = new CalibratedCancellation(microphone, probe.left, probe.right);
    expect(filter.quality.accepted).toBe(false);
    expect(() => filter.process(new Float32Array(480), new Float32Array(480), new Float32Array(480))).toThrow(/calibration was not reliable/);
    const silent = new CalibratedCancellation(new Float32Array(probe.left.length), probe.left, probe.right);
    expect(silent.quality.accepted).toBe(false);
  });

  it("estimates distortion between search-grid values without counting the distorted guide", () => {
    const probe = createCalibrationProbe();
    const speaker = (value: number) => Math.tanh(value * 7.3) / 7.3;
    const echo = (left: Float32Array, right: Float32Array) => left.map((_, i) => 0.4 * speaker(left[i - 3120] ?? 0) + 0.25 * speaker(right[i - 3120] ?? 0));
    const filter = new CalibratedCancellation(echo(probe.left, probe.right), probe.left, probe.right);
    expect(filter.quality.accepted).toBe(true);
    expect(filter.quality.nonlinearity).toBeCloseTo(7.5, 0);
    const guide = Float32Array.from({ length: 3 * 48000 }, (_, i) => 0.22 * Math.sin(2 * Math.PI * 220 * i / 48000));
    const microphone = echo(guide, guide).map((v, i) => v + (i >= 48000 && i < 2 * 48000 ? 0.06 * Math.sin(2 * Math.PI * 220 * i / 48000 + 1.1) : 0));
    const pitch = new StreamingPitch(new PitchyPitchDetectorAdapter(SPEAKER_PITCH_OPTIONS), { minFrequencyHz: 65, maxFrequencyHz: 1100 }, 48000);
    const frames = [];
    for (let i = 0; i < guide.length; i += 480) frames.push(...pitch.push(filter.process(microphone.subarray(i, i + 480), guide.subarray(i, i + 480), guide.subarray(i, i + 480)), i));
    expect(frames.filter((f) => f.timeMs > 1100 && f.timeMs < 1900).every((f) => f.frequencyHz !== null && Math.abs(f.frequencyHz - 220) < 2)).toBe(true);
    expect(frames.filter((f) => f.timeMs < 900 || f.timeMs > 2100).every((f) => f.frequencyHz === null)).toBe(true);
  });
});
