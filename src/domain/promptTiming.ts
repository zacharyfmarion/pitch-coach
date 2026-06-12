import type { PromptStyle, TargetSegment } from "./contracts";

export const CHORD_PROMPT_DURATION_BEATS = 1.05;
export const CHORD_PROMPT_GAP_BEATS = 0.45;
export const PROMPT_COMPLETION_PADDING_BEATS = 0.25;

export type GuidePlaybackPhase = "chord" | "gap" | "sequence" | "tail";

export type PromptTimeline = {
  beatMs: number;
  chordDurationMs: number;
  chordGapMs: number;
  sequenceLeadInMs: number;
  sequenceDurationMs: number;
  completionPaddingMs: number;
  totalDurationMs: number;
};

export type GuidePlaybackFrame = {
  phase: GuidePlaybackPhase;
  playheadMs: number | null;
  activeSegmentIndices: number[];
};

export function shouldPlayPromptChord(targetSegments: TargetSegment[], promptStyle: PromptStyle) {
  return promptStyle === "chord-then-sequence" && targetSegments.length > 1;
}

export function getPromptTimeline(
  targetSegments: TargetSegment[],
  tempoBpm: number,
  promptStyle: PromptStyle
): PromptTimeline {
  const beatMs = 60000 / tempoBpm;
  const hasChordLeadIn = shouldPlayPromptChord(targetSegments, promptStyle);
  const chordDurationMs = hasChordLeadIn ? beatMs * CHORD_PROMPT_DURATION_BEATS : 0;
  const chordGapMs = hasChordLeadIn ? beatMs * CHORD_PROMPT_GAP_BEATS : 0;
  const sequenceLeadInMs = chordDurationMs + chordGapMs;
  const sequenceDurationMs = getPromptSequenceDurationMs(targetSegments);
  const completionPaddingMs = beatMs * PROMPT_COMPLETION_PADDING_BEATS;

  return {
    beatMs,
    chordDurationMs,
    chordGapMs,
    sequenceLeadInMs,
    sequenceDurationMs,
    completionPaddingMs,
    totalDurationMs: Math.max(1, sequenceLeadInMs + sequenceDurationMs + completionPaddingMs)
  };
}

export function getPromptSequenceDurationMs(targetSegments: TargetSegment[]) {
  return Math.max(1, targetSegments.at(-1)?.endMs ?? 1);
}

export function getGuidePlaybackFrame(
  targetSegments: TargetSegment[],
  tempoBpm: number,
  promptStyle: PromptStyle,
  progress: number
): GuidePlaybackFrame {
  if (targetSegments.length === 0) {
    return {
      phase: "tail",
      playheadMs: null,
      activeSegmentIndices: []
    };
  }

  const timeline = getPromptTimeline(targetSegments, tempoBpm, promptStyle);
  const elapsedMs = Math.min(1, Math.max(0, progress)) * timeline.totalDurationMs;

  if (timeline.chordDurationMs > 0 && elapsedMs < timeline.chordDurationMs) {
    return {
      phase: "chord",
      playheadMs: null,
      activeSegmentIndices: targetSegments.map((_segment, index) => index)
    };
  }

  if (timeline.sequenceLeadInMs > 0 && elapsedMs < timeline.sequenceLeadInMs) {
    return {
      phase: "gap",
      playheadMs: null,
      activeSegmentIndices: []
    };
  }

  const sequencePlayheadMs = elapsedMs - timeline.sequenceLeadInMs;
  if (sequencePlayheadMs > timeline.sequenceDurationMs) {
    return {
      phase: "tail",
      playheadMs: null,
      activeSegmentIndices: []
    };
  }

  const clampedPlayheadMs = Math.min(Math.max(sequencePlayheadMs, 0), timeline.sequenceDurationMs);
  return {
    phase: "sequence",
    playheadMs: clampedPlayheadMs,
    activeSegmentIndices: getActiveGuideSegmentIndices(targetSegments, clampedPlayheadMs)
  };
}

function getActiveGuideSegmentIndices(targetSegments: TargetSegment[], playheadMs: number) {
  const activeIndex = targetSegments.findIndex(
    (segment) => playheadMs >= segment.startMs - 80 && playheadMs <= segment.endMs + 80
  );
  if (activeIndex !== -1) {
    return [activeIndex];
  }

  const nextIndex = targetSegments.findIndex((segment) => playheadMs < segment.endMs);
  return [nextIndex === -1 ? targetSegments.length - 1 : nextIndex];
}
