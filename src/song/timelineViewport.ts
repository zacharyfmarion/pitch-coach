export type SongTimelineViewport = {
  startMs: number;
  endMs: number;
};

export function createSongTimelineViewport(
  totalDurationMs: number,
  currentTimeMs: number,
  isPlaying: boolean
): SongTimelineViewport {
  const durationMs = Math.max(totalDurationMs, 1000);
  const windowMs = durationMs <= 14000 ? durationMs : 12000;
  if (durationMs <= windowMs) {
    return {
      startMs: 0,
      endMs: durationMs
    };
  }

  const playheadBias = isPlaying ? 0.38 : 0.15;
  const startMs = Math.min(
    Math.max(0, currentTimeMs - windowMs * playheadBias),
    Math.max(0, durationMs - windowMs)
  );

  return {
    startMs,
    endMs: startMs + windowMs
  };
}
