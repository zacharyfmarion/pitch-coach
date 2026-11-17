import type { PitchFrame } from "../domain/contracts";
import type { PitchDetectionBounds, PitchDetectorAdapter } from "./types";

export const LIVE_PITCH_FRAME_SIZE = 4096;
export const LIVE_PITCH_HOP_SIZE = 960;

/** Timestamps refer to window centers, not when a queued message is handled. */
export class StreamingPitch {
  private readonly buffer = new Float32Array(LIVE_PITCH_FRAME_SIZE);
  private used = 0;

  constructor(
    private readonly detector: PitchDetectorAdapter,
    private readonly bounds: PitchDetectionBounds,
    private readonly sampleRate: number,
    private readonly delaySamples = 0
  ) {}

  push(samples: Float32Array, blockStartSample: number): PitchFrame[] {
    const frames: PitchFrame[] = [];
    for (let i = 0; i < samples.length; i += 1) {
      this.buffer[this.used++] = samples[i];
      if (this.used === this.buffer.length) {
        const centerSample = blockStartSample + i + 1 - this.buffer.length / 2 - this.delaySamples;
        frames.push(this.detector.detectPitch(this.buffer, this.sampleRate, centerSample / this.sampleRate * 1000, this.bounds));
        this.buffer.copyWithin(0, LIVE_PITCH_HOP_SIZE);
        this.used -= LIVE_PITCH_HOP_SIZE;
      }
    }
    return frames;
  }
}
