import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  AttemptScore,
  LessonStatus,
  PitchFrame,
  TargetNoteSegment,
  TargetSegment
} from "../domain/contracts";
import { frequencyToMidi, midiToNoteName } from "../domain/music";

const LIVE_SILENCE_RMS = 0.006;
const LIVE_MAX_GAP_MS = 220;
const LIVE_TARGET_ADVANCE_MARGIN_CENTS = 75;
const LIVE_TARGET_SWITCH_CONFIRM_MS = 80;

type PitchTimelineProps = {
  frames: PitchFrame[];
  targetSegments: TargetSegment[];
  attemptScore: AttemptScore | null;
  totalDurationMs: number;
  toleranceCents: number;
  status: LessonStatus;
  themeName: string;
};

export function PitchTimeline({
  frames,
  targetSegments,
  attemptScore,
  totalDurationMs,
  toleranceCents,
  status,
  themeName
}: PitchTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height
      });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) {
      return;
    }

    drawTimeline(canvas, {
      frames,
      targetSegments,
      attemptScore,
      totalDurationMs,
      toleranceCents,
      status,
      themeName,
      width: size.width,
      height: size.height
    });
  }, [attemptScore, frames, size, status, targetSegments, themeName, toleranceCents, totalDurationMs]);

  return (
    <div className="timeline-frame">
      <canvas
        ref={canvasRef}
        className="pitch-timeline"
        aria-label="Pitch timeline"
        role="img"
      />
    </div>
  );
}

type DrawTimelineOptions = PitchTimelineProps & {
  width: number;
  height: number;
};

type TimelinePalette = {
  surface: string;
  targetBand: string;
  targetLine: string;
  targetText: string;
  statusText: string;
  gridBorder: string;
  gridLine: string;
  gridStrongLine: string;
  gridLabel: string;
  timeMarker: string;
  ignoredEvent: string;
  pitchLine: string;
  noisyFrame: string;
  passLine: string;
  errorLine: string;
};

const fallbackTimelinePalette = {
  surface: "#1b1f27",
  targetBand: "rgba(97, 175, 239, 0.18)",
  targetLine: "rgba(97, 175, 239, 0.78)",
  targetText: "#abb2bf",
  statusText: "#828997",
  gridBorder: "#3e4452",
  gridLine: "rgba(171, 178, 191, 0.08)",
  gridStrongLine: "rgba(171, 178, 191, 0.16)",
  gridLabel: "#828997",
  timeMarker: "rgba(62, 68, 82, 0.88)",
  ignoredEvent: "rgba(130, 137, 151, 0.28)",
  pitchLine: "rgba(198, 120, 221, 0.78)",
  noisyFrame: "rgba(224, 108, 117, 0.28)",
  passLine: "#98c379",
  errorLine: "#e06c75"
} satisfies TimelinePalette;

const timelinePaletteVariables = {
  surface: "--timeline-surface",
  targetBand: "--timeline-target-band",
  targetLine: "--timeline-target-line",
  targetText: "--timeline-target-text",
  statusText: "--timeline-status-text",
  gridBorder: "--timeline-grid-border",
  gridLine: "--timeline-grid-line",
  gridStrongLine: "--timeline-grid-strong-line",
  gridLabel: "--timeline-grid-label",
  timeMarker: "--timeline-time-marker",
  ignoredEvent: "--timeline-ignored-event",
  pitchLine: "--timeline-pitch-line",
  noisyFrame: "--timeline-noisy-frame",
  passLine: "--timeline-pass-line",
  errorLine: "--timeline-error-line"
} satisfies Record<keyof TimelinePalette, string>;

function readTimelinePalette(canvas: HTMLCanvasElement): TimelinePalette {
  const computedStyle = getComputedStyle(canvas);
  return Object.fromEntries(
    Object.entries(timelinePaletteVariables).map(([key, variableName]) => [
      key,
      computedStyle.getPropertyValue(variableName).trim() ||
        fallbackTimelinePalette[key as keyof TimelinePalette]
    ])
  ) as TimelinePalette;
}

function drawTimeline(canvas: HTMLCanvasElement, options: DrawTimelineOptions) {
  const palette = readTimelinePalette(canvas);
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(options.width * pixelRatio);
  canvas.height = Math.floor(options.height * pixelRatio);

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, options.width, options.height);
  context.fillStyle = palette.surface;
  context.fillRect(0, 0, options.width, options.height);

  const padding = { top: 28, right: 24, bottom: 30, left: 54 };
  const plotWidth = Math.max(options.width - padding.left - padding.right, 1);
  const plotHeight = Math.max(options.height - padding.top - padding.bottom, 1);
  const visibleMidis = [
    ...options.targetSegments.flatMap(getSegmentMidis),
    ...options.frames
      .filter((frame) => frame.frequencyHz !== null)
      .map((frame) => frequencyToMidi(frame.frequencyHz!)),
    ...(options.attemptScore?.events.map((event) => event.medianMidi) ?? [])
  ];
  const minMidi = Math.floor(Math.min(...visibleMidis)) - 1;
  const maxMidi = Math.ceil(Math.max(...visibleMidis)) + 1;
  const centsAsMidi = options.toleranceCents / 100;
  const renderedTargetSpans = getRenderedTargetSpans(options);

  const xForTime = (timeMs: number) =>
    padding.left +
    (Math.min(Math.max(timeMs, 0), options.totalDurationMs) / Math.max(options.totalDurationMs, 1)) *
      plotWidth;
  const yForMidi = (midi: number) =>
    padding.top + (1 - (midi - minMidi) / (maxMidi - minMidi)) * plotHeight;

  drawGrid(
    context,
    renderedTargetSpans,
    padding,
    plotWidth,
    plotHeight,
    xForTime,
    yForMidi,
    minMidi,
    maxMidi,
    palette
  );

  renderedTargetSpans.forEach(({ segment, startMs, endMs }) => {
    const x = xForTime(startMs);
    const width = Math.max(6, xForTime(endMs) - x);
    context.fillStyle = palette.targetBand;
    context.strokeStyle = palette.targetLine;
    context.lineWidth = 2;
    context.font = "600 12px system-ui, sans-serif";

    if (segment.kind === "note") {
      const yTop = yForMidi(segment.midi + centsAsMidi);
      const yBottom = yForMidi(segment.midi - centsAsMidi);
      const yCenter = yForMidi(segment.midi);

      context.fillRect(x, yTop, width, yBottom - yTop);
      context.beginPath();
      context.moveTo(x, yCenter);
      context.lineTo(x + width, yCenter);
      context.stroke();
      context.fillStyle = palette.targetText;
      context.fillText(segment.noteName, x + 8, yCenter - 8);
      return;
    }

    const xEnd = xForTime(endMs);
    const yStart = yForMidi(segment.fromMidi);
    const yEnd = yForMidi(segment.toMidi);
    context.beginPath();
    context.moveTo(x, yForMidi(segment.fromMidi + centsAsMidi));
    context.lineTo(xEnd, yForMidi(segment.toMidi + centsAsMidi));
    context.lineTo(xEnd, yForMidi(segment.toMidi - centsAsMidi));
    context.lineTo(x, yForMidi(segment.fromMidi - centsAsMidi));
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(x, yStart);
    context.lineTo(xEnd, yEnd);
    context.stroke();
    context.fillStyle = palette.targetText;
    context.fillText(segment.shortLabel, x + 8, Math.min(yStart, yEnd) - 8);
  });

  drawPitchLine(context, options.frames, xForTime, yForMidi, palette);
  drawIgnoredEvents(context, options.attemptScore, xForTime, yForMidi, palette);
  drawStablePlateaus(context, options.attemptScore, xForTime, yForMidi, palette);

  context.fillStyle = palette.statusText;
  context.font = "600 12px system-ui, sans-serif";
  context.fillText(
    getCanvasStatusLabel(options.status),
    padding.left,
    18
  );
}

export type RenderedTargetSpan = {
  segment: TargetSegment;
  startMs: number;
  endMs: number;
};

function getRenderedTargetSpans(options: DrawTimelineOptions): RenderedTargetSpan[] {
  if (!options.attemptScore) {
    const noteTargets = options.targetSegments.filter(isTargetNoteSegment);
    const liveSpans =
      noteTargets.length === options.targetSegments.length &&
      (options.status === "listening" || options.status === "awaitingVoice")
        ? getLiveTargetSpans(options.frames, noteTargets)
        : [];

    if (liveSpans.length > 0) {
      return liveSpans;
    }

    return options.targetSegments.map((segment) => ({
      segment,
      startMs: segment.startMs,
      endMs: segment.endMs
    }));
  }

  return options.attemptScore.segments.map((segment) => {
    const startMs = segment.sungEvent?.startMs ?? segment.sungContour?.startMs ?? segment.score.stableStartMs ?? segment.startMs;
    const endMs = segment.sungEvent?.endMs ?? segment.sungContour?.endMs ?? segment.score.stableEndMs ?? segment.endMs;
    return {
      segment,
      startMs,
      endMs: Math.max(endMs, startMs + 180)
    };
  });
}

export function getLiveTargetSpans(frames: PitchFrame[], targetNotes: TargetNoteSegment[]): RenderedTargetSpan[] {
  const assignments = assignLiveFramesToTargets(frames, targetNotes);
  const guideDurationMs = Math.max(360, targetNotes[0] ? targetNotes[0].endMs - targetNotes[0].startMs : 600);
  let cursorMs = 0;

  return targetNotes.map((note, index) => {
    const assignment = assignments[index];
    if (assignment) {
      cursorMs = Math.max(cursorMs, assignment.endMs + 120);
      return {
        segment: note,
        startMs: assignment.startMs,
        endMs: Math.max(assignment.endMs, assignment.startMs + 180)
      };
    }

    const startMs = Math.max(note.startMs, cursorMs);
    cursorMs = startMs + guideDurationMs;
    return {
      segment: note,
      startMs,
      endMs: cursorMs
    };
  });
}

type LiveTargetAssignment = {
  startMs: number;
  endMs: number;
};

function assignLiveFramesToTargets(
  frames: PitchFrame[],
  targetNotes: TargetNoteSegment[]
): Array<LiveTargetAssignment | null> {
  const assignments: Array<LiveTargetAssignment | null> = targetNotes.map(() => null);
  const voicedFrames = smoothLiveFrames(frames.filter(isLiveVoicedFrame));
  let activeTargetIndex = 0;
  let pendingTargetIndex: number | null = null;
  let pendingStartedMs = 0;
  let previousVoicedMs: number | null = null;

  voicedFrames.forEach((frame) => {
    if (targetNotes.length === 0) {
      return;
    }

    const hasGap = previousVoicedMs !== null && frame.timeMs - previousVoicedMs > LIVE_MAX_GAP_MS;
    const desiredIndex = chooseLiveTargetIndex(frame.midi, activeTargetIndex, targetNotes);
    if (desiredIndex > activeTargetIndex) {
      if (hasGap || !assignments[activeTargetIndex]) {
        activeTargetIndex = desiredIndex;
        pendingTargetIndex = null;
      } else if (pendingTargetIndex !== desiredIndex) {
        pendingTargetIndex = desiredIndex;
        pendingStartedMs = frame.timeMs;
      } else if (frame.timeMs - pendingStartedMs >= LIVE_TARGET_SWITCH_CONFIRM_MS) {
        activeTargetIndex = desiredIndex;
        pendingTargetIndex = null;
      }
    } else {
      pendingTargetIndex = null;
    }

    const assignment = assignments[activeTargetIndex];
    if (assignment) {
      assignment.endMs = frame.timeMs;
    } else {
      assignments[activeTargetIndex] = {
        startMs: frame.timeMs,
        endMs: frame.timeMs
      };
    }

    previousVoicedMs = frame.timeMs;
  });

  return assignments;
}

type LiveVoicedFrame = PitchFrame & {
  frequencyHz: number;
  midi: number;
};

function smoothLiveFrames(frames: PitchFrame[]): LiveVoicedFrame[] {
  return frames.map((frame, index) => {
    const midiWindow = frames
      .slice(Math.max(0, index - 1), Math.min(frames.length, index + 2))
      .map((candidate) => frequencyToMidi(candidate.frequencyHz!));
    return {
      ...frame,
      frequencyHz: frame.frequencyHz!,
      midi: median(midiWindow)
    };
  });
}

function chooseLiveTargetIndex(midi: number, activeTargetIndex: number, targetNotes: TargetNoteSegment[]) {
  let targetIndex = activeTargetIndex;
  while (targetIndex < targetNotes.length - 1) {
    const currentDistanceCents = Math.abs(midi - targetNotes[targetIndex].midi) * 100;
    const nextDistanceCents = Math.abs(midi - targetNotes[targetIndex + 1].midi) * 100;
    if (nextDistanceCents + LIVE_TARGET_ADVANCE_MARGIN_CENTS >= currentDistanceCents) {
      break;
    }

    targetIndex += 1;
  }

  return targetIndex;
}

function isLiveVoicedFrame(frame: PitchFrame) {
  return frame.frequencyHz !== null && frame.rms >= LIVE_SILENCE_RMS;
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function getCanvasStatusLabel(status: LessonStatus) {
  switch (status) {
    case "awaitingVoice":
      return "Waiting for voice";
    case "listening":
      return "Sing now";
    case "retry":
      return "Ready to retry";
    case "passed":
      return "Passed";
    default:
      return "Awaiting attempt";
  }
}

function drawGrid(
  context: CanvasRenderingContext2D,
  targetSpans: RenderedTargetSpan[],
  padding: { top: number; right: number; bottom: number; left: number },
  plotWidth: number,
  plotHeight: number,
  xForTime: (timeMs: number) => number,
  yForMidi: (midi: number) => number,
  minMidi: number,
  maxMidi: number,
  palette: TimelinePalette
) {
  context.strokeStyle = palette.gridBorder;
  context.lineWidth = 1;
  context.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

  for (let midi = Math.ceil(minMidi); midi <= Math.floor(maxMidi); midi += 1) {
    const y = yForMidi(midi);
    context.strokeStyle = midi % 12 === 0 ? palette.gridStrongLine : palette.gridLine;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(padding.left + plotWidth, y);
    context.stroke();

    if (midi % 2 === 0) {
      context.fillStyle = palette.gridLabel;
      context.font = "11px system-ui, sans-serif";
      context.fillText(midiToNoteName(midi), 10, y + 4);
    }
  }

  targetSpans.forEach(({ startMs }) => {
    const x = xForTime(startMs);
    context.strokeStyle = palette.timeMarker;
    context.beginPath();
    context.moveTo(x, padding.top);
    context.lineTo(x, padding.top + plotHeight);
    context.stroke();
  });
}

function drawIgnoredEvents(
  context: CanvasRenderingContext2D,
  attemptScore: AttemptScore | null,
  xForTime: (timeMs: number) => number,
  yForMidi: (midi: number) => number,
  palette: TimelinePalette
) {
  if (!attemptScore) {
    return;
  }

  attemptScore.ignoredEventIndices.forEach((eventIndex) => {
    const event = attemptScore.events[eventIndex];
    if (!event) {
      return;
    }

    const xStart = xForTime(event.stableStartMs);
    const xEnd = xForTime(event.stableEndMs);
    const y = yForMidi(event.medianMidi);
    context.strokeStyle = palette.ignoredEvent;
    context.lineWidth = 4;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(xStart, y);
    context.lineTo(xEnd, y);
    context.stroke();
  });
}

function drawPitchLine(
  context: CanvasRenderingContext2D,
  frames: PitchFrame[],
  xForTime: (timeMs: number) => number,
  yForMidi: (midi: number) => number,
  palette: TimelinePalette
) {
  context.lineWidth = 3;
  context.strokeStyle = palette.pitchLine;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.beginPath();

  let drawing = false;
  frames.forEach((frame) => {
    if (frame.frequencyHz === null) {
      drawing = false;
      return;
    }

    const x = xForTime(frame.timeMs);
    const y = yForMidi(frequencyToMidi(frame.frequencyHz));
    if (!drawing) {
      context.moveTo(x, y);
      drawing = true;
    } else {
      context.lineTo(x, y);
    }
  });

  context.stroke();

  frames
    .filter((frame) => frame.frequencyHz === null && frame.rms > 0.006)
    .forEach((frame) => {
      context.fillStyle = palette.noisyFrame;
      context.beginPath();
      context.arc(xForTime(frame.timeMs), 20, 3, 0, Math.PI * 2);
      context.fill();
    });
}

function drawStablePlateaus(
  context: CanvasRenderingContext2D,
  attemptScore: AttemptScore | null,
  xForTime: (timeMs: number) => number,
  yForMidi: (midi: number) => number,
  palette: TimelinePalette
) {
  if (!attemptScore) {
    return;
  }

  attemptScore.segments.forEach((segment) => {
    if (
      segment.kind !== "note" ||
      segment.score.stableStartMs === undefined ||
      segment.score.stableEndMs === undefined ||
      segment.score.medianCents === undefined
    ) {
      return;
    }

    const xStart = xForTime(segment.score.stableStartMs);
    const xEnd = xForTime(segment.score.stableEndMs);
    const y = yForMidi(segment.midi + segment.score.medianCents / 100);
    context.strokeStyle =
      segment.score.status === "pass" || segment.score.status === "passWithWarning"
        ? palette.passLine
        : palette.errorLine;
    context.lineWidth = 5;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(xStart, y);
    context.lineTo(xEnd, y);
    context.stroke();
  });
}

function getSegmentMidis(segment: TargetSegment) {
  return segment.kind === "note" ? [segment.midi] : [segment.fromMidi, segment.toMidi];
}

function isTargetNoteSegment(segment: TargetSegment): segment is TargetNoteSegment {
  return segment.kind === "note";
}
