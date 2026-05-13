import type { PitchFrame, PromptStyle, TargetNote } from "../domain/contracts";

export type PitchDetectionBounds = {
  minFrequencyHz: number;
  maxFrequencyHz: number;
};

export interface PitchDetectorAdapter {
  detectPitch(
    samples: Float32Array,
    sampleRate: number,
    timeMs: number,
    bounds: PitchDetectionBounds
  ): PitchFrame;
}

export type AudioCaptureConfig = {
  detector: PitchDetectorAdapter;
  bounds: PitchDetectionBounds;
  onPitchFrame: (frame: PitchFrame) => void;
  captureAudioClip?: boolean;
  onAudioClip?: (clip: CapturedAudioClip) => void;
};

export type CapturedAudioClip = {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  createdAt: string;
};

export interface AudioInputEngine {
  startCapture(config: AudioCaptureConfig): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

export interface PromptPlayer {
  playPrompt(targetNotes: TargetNote[], tempoBpm: number, promptStyle: PromptStyle): Promise<void>;
  cancel(): void;
}
