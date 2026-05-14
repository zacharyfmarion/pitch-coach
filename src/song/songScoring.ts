import type { PitchFrame } from "../domain/contracts";
import { frequencyToMidi } from "../domain/music";
import type {
  SongComparisonStatus,
  SongReference,
  SongReferenceFrame,
  SongScore,
  SongScoreRegion
} from "./types";

const MAX_ALIGNMENT_GAP_MS = 150;
const MAX_REGION_GAP_MS = 260;
const AUDIBLE_RMS = 0.006;

type ComparedFrame = {
  timeMs: number;
  status: SongComparisonStatus;
  cents?: number;
};

export function scoreSongAttempt(
  reference: SongReference,
  liveFrames: PitchFrame[],
  toleranceCents: number
): SongScore {
  const comparedFrames = reference.frames
    .filter(isVoicedReferenceFrame)
    .map((referenceFrame) => compareReferenceFrame(referenceFrame, liveFrames, toleranceCents));
  const regions = buildScoreRegions(comparedFrames);
  const tunedCount = comparedFrames.filter((frame) => frame.status === "inTune").length;
  const comparedFrameCount = comparedFrames.length;
  const tunedRatio = comparedFrameCount === 0 ? 0 : tunedCount / comparedFrameCount;

  return {
    regions,
    tunedRatio,
    comparedFrameCount,
    summary: createSongScoreSummary(regions, tunedRatio, comparedFrameCount)
  };
}

function compareReferenceFrame(
  referenceFrame: SongReferenceFrame & { midi: number },
  liveFrames: PitchFrame[],
  toleranceCents: number
): ComparedFrame {
  const liveFrame = findNearestFrame(liveFrames, referenceFrame.timeMs);
  if (!liveFrame) {
    return {
      timeMs: referenceFrame.timeMs,
      status: "missed"
    };
  }

  if (liveFrame.frequencyHz === null) {
    return {
      timeMs: referenceFrame.timeMs,
      status: liveFrame.rms >= AUDIBLE_RMS ? "unclear" : "missed"
    };
  }

  const cents = (frequencyToMidi(liveFrame.frequencyHz) - referenceFrame.midi) * 100;
  if (Math.abs(cents) <= toleranceCents) {
    return {
      timeMs: referenceFrame.timeMs,
      status: "inTune",
      cents
    };
  }

  return {
    timeMs: referenceFrame.timeMs,
    status: cents < 0 ? "flat" : "sharp",
    cents
  };
}

function buildScoreRegions(frames: ComparedFrame[]): SongScoreRegion[] {
  const regions: SongScoreRegion[] = [];

  frames.forEach((frame) => {
    const previous = regions.at(-1);
    if (
      previous &&
      previous.status === frame.status &&
      frame.timeMs - previous.endMs <= MAX_REGION_GAP_MS
    ) {
      previous.endMs = frame.timeMs;
      previous.medianCents = medianCentsForRegion(previous, frames);
      return;
    }

    regions.push({
      id: `song-region-${regions.length}`,
      status: frame.status,
      startMs: frame.timeMs,
      endMs: frame.timeMs,
      medianCents: frame.cents
    });
  });

  return regions.map((region) => ({
    ...region,
    endMs: Math.max(region.endMs, region.startMs + 180)
  }));
}

function medianCentsForRegion(region: SongScoreRegion, frames: ComparedFrame[]) {
  const cents = frames
    .filter((frame) => frame.timeMs >= region.startMs && frame.timeMs <= region.endMs)
    .map((frame) => frame.cents)
    .filter((value): value is number => value !== undefined);
  return cents.length > 0 ? median(cents) : undefined;
}

function findNearestFrame(frames: PitchFrame[], timeMs: number): PitchFrame | null {
  let nearest: PitchFrame | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  frames.forEach((frame) => {
    const distance = Math.abs(frame.timeMs - timeMs);
    if (distance < nearestDistance) {
      nearest = frame;
      nearestDistance = distance;
    }
  });

  return nearestDistance <= MAX_ALIGNMENT_GAP_MS ? nearest : null;
}

function createSongScoreSummary(
  regions: SongScoreRegion[],
  tunedRatio: number,
  comparedFrameCount: number
) {
  if (comparedFrameCount === 0) {
    return "No vocal reference was available to score.";
  }

  const firstIssue = regions.find((region) => region.status !== "inTune");
  if (!firstIssue) {
    return "Strong match. Your pitch tracked the vocal line.";
  }

  const percentage = Math.round(tunedRatio * 100);
  switch (firstIssue.status) {
    case "flat":
      return `${percentage}% in tune. First issue: flat around ${formatTime(firstIssue.startMs)}.`;
    case "sharp":
      return `${percentage}% in tune. First issue: sharp around ${formatTime(firstIssue.startMs)}.`;
    case "missed":
      return `${percentage}% in tune. First issue: missed vocal around ${formatTime(firstIssue.startMs)}.`;
    case "unclear":
      return `${percentage}% in tune. First issue: unclear pitch around ${formatTime(firstIssue.startMs)}.`;
    case "inTune":
      return `${percentage}% in tune.`;
  }
}

function formatTime(timeMs: number) {
  const totalSeconds = Math.max(0, Math.round(timeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function isVoicedReferenceFrame(
  frame: SongReferenceFrame
): frame is SongReferenceFrame & { midi: number; frequencyHz: number } {
  return frame.midi !== null && frame.frequencyHz !== null;
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}
