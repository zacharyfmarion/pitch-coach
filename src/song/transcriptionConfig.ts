import type { SongReferenceDetail } from "./types";

export type SongReferenceDetailConfig = {
  label: string;
  onsetThreshold: number;
  frameThreshold: number;
  minNoteFrames: number;
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
    onsetThreshold: 0.3,
    frameThreshold: 0.25,
    minNoteFrames: 6
  },
  balanced: {
    label: "Balanced",
    onsetThreshold: 0.2,
    frameThreshold: 0.18,
    minNoteFrames: 4
  },
  sensitive: {
    label: "Sensitive",
    onsetThreshold: 0.12,
    frameThreshold: 0.1,
    minNoteFrames: 3
  }
};

export const DEFAULT_REFERENCE_DETAIL: SongReferenceDetail = "balanced";
