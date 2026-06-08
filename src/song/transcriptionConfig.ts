import type { SongReferenceDetail } from "./types";

export type SongReferenceDetailConfig = {
  label: string;
  frameThreshold: number;
  onsetSplitThreshold: number;
  minStableFrames: number;
  minNoteDurationMs: number;
  maxGapFillMs: number;
  maxSamePitchMergeGapMs: number;
};

export const REFERENCE_DETAIL_OPTIONS: Array<{
  value: SongReferenceDetail;
  label: string;
}> = [
  { value: "clean", label: "Clean" },
  { value: "balanced", label: "Balanced" },
  { value: "sensitive", label: "Sensitive" }
];

export const REFERENCE_DETAIL_CONFIG: Record<SongReferenceDetail, SongReferenceDetailConfig> = {
  clean: {
    label: "Clean",
    frameThreshold: 0.34,
    onsetSplitThreshold: 0.95,
    minStableFrames: 6,
    minNoteDurationMs: 80,
    maxGapFillMs: 100,
    maxSamePitchMergeGapMs: 100
  },
  balanced: {
    label: "Balanced",
    frameThreshold: 0.22,
    onsetSplitThreshold: 0.9,
    minStableFrames: 4,
    minNoteDurationMs: 55,
    maxGapFillMs: 80,
    maxSamePitchMergeGapMs: 80
  },
  sensitive: {
    label: "Sensitive",
    frameThreshold: 0.13,
    onsetSplitThreshold: 0.82,
    minStableFrames: 4,
    minNoteDurationMs: 55,
    maxGapFillMs: 80,
    maxSamePitchMergeGapMs: 80
  }
};

export const DEFAULT_REFERENCE_DETAIL: SongReferenceDetail = "balanced";
