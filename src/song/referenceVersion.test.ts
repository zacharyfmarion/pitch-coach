import { describe, expect, it } from "vitest";
import {
  isCurrentSongReference,
  SONG_REFERENCE_ANALYSIS_VERSION
} from "./referenceVersion";
import type { SongReference } from "./types";

describe("song reference versioning", () => {
  it("accepts only references from the current transcription build", () => {
    expect(isCurrentSongReference(referenceWithVersion(SONG_REFERENCE_ANALYSIS_VERSION))).toBe(true);
    expect(isCurrentSongReference(referenceWithVersion("older-build"))).toBe(false);
    expect(isCurrentSongReference(referenceWithVersion(undefined))).toBe(false);
    expect(isCurrentSongReference(null)).toBe(false);
  });
});

function referenceWithVersion(analysisVersion: string | undefined): SongReference {
  return {
    analysisVersion,
    frames: [],
    notes: [],
    contour: [],
    phrases: [],
    quality: { noteCount: 0, lowConfidenceCount: 0, suggestion: null },
    durationMs: 0
  };
}
