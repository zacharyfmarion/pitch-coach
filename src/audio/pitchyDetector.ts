import { PitchDetector } from "pitchy";
import type { PitchFrame } from "../domain/contracts";
import type { PitchDetectionBounds, PitchDetectorAdapter } from "./types";

type PitchyDetector = ReturnType<typeof PitchDetector.forFloat32Array>;

export type PitchyPitchDetectorOptions = {
  clarityThreshold?: number;
  rmsThreshold?: number;
};

export class PitchyPitchDetectorAdapter implements PitchDetectorAdapter {
  private detector: PitchyDetector | null = null;
  private inputLength = 0;
  private readonly clarityThreshold: number;
  private readonly rmsThreshold: number;

  constructor(options: PitchyPitchDetectorOptions = {}) {
    this.clarityThreshold = options.clarityThreshold ?? 0.72;
    this.rmsThreshold = options.rmsThreshold ?? 0.006;
  }

  detectPitch(
    samples: Float32Array,
    sampleRate: number,
    timeMs: number,
    bounds: PitchDetectionBounds
  ): PitchFrame {
    this.ensureDetector(samples.length);
    const rms = calculateRms(samples);
    const [pitchHz, clarity] = this.detector!.findPitch(samples, sampleRate);
    const isUsable =
      Number.isFinite(pitchHz) &&
      rms >= this.rmsThreshold &&
      clarity >= this.clarityThreshold &&
      pitchHz >= bounds.minFrequencyHz &&
      pitchHz <= bounds.maxFrequencyHz;

    return {
      timeMs,
      frequencyHz: isUsable ? pitchHz : null,
      clarity,
      rms
    };
  }

  private ensureDetector(inputLength: number) {
    if (this.detector && this.inputLength === inputLength) {
      return;
    }

    this.detector = PitchDetector.forFloat32Array(inputLength);
    this.inputLength = inputLength;
  }
}

export function calculateRms(samples: Float32Array) {
  if (samples.length === 0) {
    return 0;
  }

  let sumSquares = 0;
  for (const sample of samples) {
    sumSquares += sample * sample;
  }

  return Math.sqrt(sumSquares / samples.length);
}
