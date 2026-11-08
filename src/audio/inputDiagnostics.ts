import type { PitchFrame } from "../domain/contracts";
import type { PitchDetectionBounds } from "./types";
import type { PitchyPitchDetectorOptions } from "./pitchyDetector";
import type { CalibrationQuality } from "./calibratedCancellation";

export const RAW_DIAGNOSTIC_THRESHOLDS = { clarityThreshold: 0.66, rmsThreshold: 0.005 } as const;

export type PitchRejection = "accepted" | "below-level" | "unclear" | "outside-range-or-no-pitch";

export type InputDiagnosticFrame = {
  raw: PitchFrame;
  processed: PitchFrame;
  rejection: PitchRejection;
  guideGain: number;
  processingMs: number;
  queueLagMs: number;
};

export type InputDiagnosticSession = {
  mode: "aec3" | "calibrated";
  calibration?: CalibrationQuality;
  sampleRate: number;
  inputLatencyMs: number;
  outputLatencyMs: number;
  baseLatencyMs: number;
  algorithmicDelayMs: number;
  echoCancellation?: boolean | string;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  bounds: PitchDetectionBounds;
  thresholds: Required<PitchyPitchDetectorOptions>;
  rawThresholds: Required<PitchyPitchDetectorOptions>;
};

export function pitchRejection(frame: PitchFrame, thresholds: Required<PitchyPitchDetectorOptions>): PitchRejection {
  if (frame.frequencyHz !== null) return "accepted";
  if (frame.rms < thresholds.rmsThreshold) return "below-level";
  if (frame.clarity < thresholds.clarityThreshold) return "unclear";
  return "outside-range-or-no-pitch";
}

export function levelDb(rms: number): number {
  return 20 * Math.log10(Math.max(rms, 0.000001));
}

/** Numeric measurements only; no samples, track names, device IDs, or labels. */
export class InputDiagnosticRecorder {
  private frames: InputDiagnosticFrame[] = [];
  private received = 0;
  // Two minutes at 50 Hz; normal song sections are at most 90 seconds.
  constructor(private readonly capacity = 6000) {}

  push(frame: InputDiagnosticFrame) {
    this.received += 1;
    this.frames.push(frame);
    if (this.frames.length > this.capacity) this.frames.shift();
  }

  snapshot() { return this.frames.slice(); }

  report(session: InputDiagnosticSession | null) {
    const rejected: Record<PitchRejection, number> = { accepted: 0, "below-level": 0, unclear: 0, "outside-range-or-no-pitch": 0 };
    let longestGapMs = 0;
    for (let index = 0; index < this.frames.length; index += 1) {
      rejected[this.frames[index].rejection] += 1;
      if (index > 0) longestGapMs = Math.max(longestGapMs, this.frames[index].processed.timeMs - this.frames[index - 1].processed.timeMs);
    }
    return {
      schemaVersion: 1,
      kind: "pitch-coach-input-diagnostics",
      session,
      summary: { receivedFrames: this.received, retainedFrames: this.frames.length, droppedFrames: this.received - this.frames.length, rejected, longestGapMs },
      notes: "Local numeric diagnostics only. Raw input includes speaker leakage and is not singer ground truth. Paired window centers differ by the recorded algorithmic delay. Browser/OS processing before capture is not observable here.",
      frames: this.snapshot()
    };
  }
}
