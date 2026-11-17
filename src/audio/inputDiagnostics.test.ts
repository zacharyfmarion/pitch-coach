import { describe, expect, it } from "vitest";
import { InputDiagnosticRecorder, levelDb, pitchRejection, type InputDiagnosticFrame } from "./inputDiagnostics";

const thresholds = { rmsThreshold: 0.008, clarityThreshold: 0.66 };
const frame = { timeMs: 100, frequencyHz: null, rms: 0.002, clarity: 0.99 };

describe("local input diagnostics", () => {
  it("distinguishes cancelled quiet audio from low clarity and range rejection", () => {
    expect(pitchRejection(frame, thresholds)).toBe("below-level");
    expect(pitchRejection({ ...frame, rms: 0.05, clarity: 0.5 }, thresholds)).toBe("unclear");
    expect(pitchRejection({ ...frame, rms: 0.05 }, thresholds)).toBe("outside-range-or-no-pitch");
    expect(pitchRejection({ ...frame, rms: 0.05, frequencyHz: 220 }, thresholds)).toBe("accepted");
    expect(levelDb(0)).toBe(-120);
    expect(levelDb(0.01)).toBe(-40);
  });

  it("retains bounded numeric data and exposes truncation and capture gaps", () => {
    const recorder = new InputDiagnosticRecorder(2);
    const diagnostic: InputDiagnosticFrame = { raw: { ...frame, rms: 0.05 }, processed: frame, rejection: "below-level", guideGain: 0.35, processingMs: 1, queueLagMs: 3 };
    recorder.push(diagnostic);
    const snapshot = recorder.snapshot();
    recorder.push({ ...diagnostic, processed: { ...frame, timeMs: 120 } });
    recorder.push({ ...diagnostic, processed: { ...frame, timeMs: 200 } });
    expect(snapshot).toHaveLength(1);
    const report = recorder.report(null);
    expect(report.summary).toMatchObject({ receivedFrames: 3, retainedFrames: 2, droppedFrames: 1, longestGapMs: 80, rejected: { "below-level": 2 } });
    expect(report.frames.map((value) => value.processed.timeMs)).toEqual([120, 200]);
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });
});
