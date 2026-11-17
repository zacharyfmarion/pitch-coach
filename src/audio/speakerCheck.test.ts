import { describe, expect, it } from "vitest";
import { acousticEcho } from "../../benchmarks/speaker/calibratedFixtures";
import { CALIBRATION_SAMPLES } from "./calibratedCancellation";
import { calibrateSpeakers, createSpeakerCheck } from "./speakerCheck";

describe("speaker check in room noise", () => {
  const probe = createSpeakerCheck();
  const room = { id: "street", delayMs: 78, gain: 0.7, noise: 0.0064, street: true };

  it("qualifies held notes against an independent guide after broadband calibration falls short", () => {
    const mic = acousticEcho(probe.left, probe.right, room, 913);
    const { quality } = calibrateSpeakers(mic, probe.left, probe.right);
    expect(quality.accepted).toBe(true);
    expect(quality.reductionDb).toBeLessThan(22);
    expect(quality.roomCheck?.guideDetections).toBe(0);
    expect(quality.roomCheck!.guideFrames).toBeGreaterThan(80);
    expect(quality.roomCheck!.worstHeldRecall).toBeGreaterThanOrEqual(0.95);
  });

  it("refuses guide leakage even when the broadband path was predictable", () => {
    const mic = acousticEcho(probe.left, probe.right, room, 91);
    for (let i = CALIBRATION_SAMPLES + 24000; i < mic.length; i++) mic[i] += 0.055 * Math.sin(2 * Math.PI * 220 * i / 48000);
    const processor = calibrateSpeakers(mic, probe.left, probe.right);
    expect(processor.quality.accepted).toBe(false);
    expect(processor.quality.roomCheck!.guideDetections).toBeGreaterThan(0);
    expect(() => processor.process(new Float32Array(480), new Float32Array(480), new Float32Array(480))).toThrow();
  });

  it("rejects an inaudible tone section and a clipped guide check", () => {
    const mic = acousticEcho(probe.left, probe.right, room, 913);
    mic.fill(0, CALIBRATION_SAMPLES);
    expect(calibrateSpeakers(mic, probe.left, probe.right).quality.failure).toBe("weak-input");
    mic[mic.length - 1] = -1;
    expect(calibrateSpeakers(mic, probe.left, probe.right).quality.failure).toBe("clipped");
  });
});
