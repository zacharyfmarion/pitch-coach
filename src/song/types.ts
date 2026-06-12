import type { PitchDetectionBounds, PitchDetectorAdapter } from "../audio/types";
import type { PitchFrame, VocalRange } from "../domain/contracts";

export type SongStereoBuffer = {
  sampleRate: number;
  left: Float32Array;
  right: Float32Array;
  durationMs: number;
};

export type SongStemName = "drums" | "bass" | "other" | "vocals";

export type SongStemMap = Record<SongStemName, SongStereoBuffer>;

export type SongSeparationResult = {
  vocals: SongStereoBuffer;
  accompaniment: SongStereoBuffer;
  stems: SongStemMap;
};

export type SongProgressInfo = {
  progress: number;
  currentSegment?: number;
  totalSegments?: number;
};

export type SongSeparationCallbacks = {
  onModelDownloadProgress?: (progress: SongProgressInfo) => void;
  onSeparationProgress?: (progress: SongProgressInfo) => void;
  onStatus?: (message: string) => void;
};

export interface SongVocalSeparator {
  separate(
    audio: SongStereoBuffer,
    callbacks?: SongSeparationCallbacks
  ): Promise<SongSeparationResult>;
}

export type SongRuntimeSupport = {
  supported: boolean;
  checking: boolean;
  reasons: string[];
};

export type SongReferenceFrame = PitchFrame & {
  midi: number | null;
};

export type SongReferenceDetail = "clean" | "balanced" | "sensitive";

export type SongPhrase = {
  id: string;
  startMs: number;
  endMs: number;
  medianMidi: number;
};

export type SongReferencePitchBend = {
  timeMs: number;
  midi: number;
  offsetSemitones: number;
};

export type SongReferenceNote = {
  id: string;
  startMs: number;
  endMs: number;
  midi: number;
  medianMidi: number;
  confidence: number;
  amplitude: number;
  pitchBends: SongReferencePitchBend[];
};

export type SongReferenceContourPoint = {
  timeMs: number;
  midi: number;
  confidence: number;
  noteId: string;
};

export type SongReferenceQuality = {
  noteCount: number;
  lowConfidenceCount: number;
  suggestion: string | null;
};

export type SongReference = {
  analysisVersion?: string;
  analysisRange?: VocalRange;
  frames: SongReferenceFrame[];
  notes: SongReferenceNote[];
  contour: SongReferenceContourPoint[];
  phrases: SongPhrase[];
  quality: SongReferenceQuality;
  durationMs: number;
};

export type SongTranscriptionCallbacks = {
  onProgress?: (progress: SongProgressInfo) => void;
  onStatus?: (message: string) => void;
};

export type SongTranscriptionOptions = SongTranscriptionCallbacks & {
  range: VocalRange;
  detail: SongReferenceDetail;
};

export interface SongTranscriptionService {
  transcribe(vocals: SongStereoBuffer, options: SongTranscriptionOptions): Promise<SongReference>;
}

export type SongComparisonStatus = "inTune" | "flat" | "sharp" | "missed" | "unclear";

export type SongScoreRegion = {
  id: string;
  status: SongComparisonStatus;
  startMs: number;
  endMs: number;
  medianCents?: number;
};

export type SongScore = {
  regions: SongScoreRegion[];
  tunedRatio: number;
  comparedFrameCount: number;
  summary: string;
};

export type SongPracticeConfig = {
  accompaniment: SongStereoBuffer;
  vocals: SongStereoBuffer;
  detector: PitchDetectorAdapter;
  bounds: PitchDetectionBounds;
  deviceId?: string;
  vocalGuideGain: number;
  onPitchFrame: (frame: PitchFrame) => void;
  onPlaybackTime?: (timeMs: number) => void;
  onEnded: () => void;
};

export interface SongPracticeEngine {
  start(config: SongPracticeConfig): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  setVocalGuideGain(gain: number): void;
  isRunning(): boolean;
  isPaused(): boolean;
}

export type SongModeServices = {
  detectSupport: () => Promise<SongRuntimeSupport>;
  decodeFile: (file: File) => Promise<SongStereoBuffer>;
  separator: SongVocalSeparator;
  transcriber: SongTranscriptionService;
  practiceEngine: SongPracticeEngine;
  detector: PitchDetectorAdapter;
};
