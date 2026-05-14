import type { SongReference } from "./types";

export const SONG_REFERENCE_ANALYSIS_VERSION = "basic-pitch-monophonic-v2";

export function isCurrentSongReference(reference: SongReference | null) {
  return reference?.analysisVersion === SONG_REFERENCE_ANALYSIS_VERSION;
}
