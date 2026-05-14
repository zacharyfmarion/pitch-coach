import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PitchFrame } from "../domain/contracts";
import { frequencyToMidi, midiToNoteName } from "../domain/music";
import type { SongReference, SongScore } from "./types";

type SongPitchTimelineProps = {
  reference: SongReference | null;
  liveFrames: PitchFrame[];
  score: SongScore | null;
  totalDurationMs: number;
  currentTimeMs: number;
  isPlaying: boolean;
};

export function SongPitchTimeline({
  reference,
  liveFrames,
  score,
  totalDurationMs,
  currentTimeMs,
  isPlaying
}: SongPitchTimelineProps) {
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

    drawSongTimeline(canvas, {
      reference,
      liveFrames,
      score,
      totalDurationMs,
      currentTimeMs,
      isPlaying,
      width: size.width,
      height: size.height
    });
  }, [currentTimeMs, isPlaying, liveFrames, reference, score, size.height, size.width, totalDurationMs]);

  return (
    <div className="timeline-frame song-timeline-frame">
      <canvas
        ref={canvasRef}
        className="pitch-timeline"
        aria-label="Song pitch timeline"
        role="img"
      />
    </div>
  );
}

type DrawSongTimelineOptions = SongPitchTimelineProps & {
  width: number;
  height: number;
};

function drawSongTimeline(canvas: HTMLCanvasElement, options: DrawSongTimelineOptions) {
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(options.width * pixelRatio);
  canvas.height = Math.floor(options.height * pixelRatio);

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, options.width, options.height);
  context.fillStyle = "#fcfbf7";
  context.fillRect(0, 0, options.width, options.height);

  const padding = { top: 28, right: 24, bottom: 30, left: 54 };
  const plotWidth = Math.max(options.width - padding.left - padding.right, 1);
  const plotHeight = Math.max(options.height - padding.top - padding.bottom, 1);
  const viewport = createTimelineViewport(options.totalDurationMs, options.currentTimeMs, options.isPlaying);
  const visibleMidis = [
    ...(options.reference?.notes.map((note) => note.medianMidi) ?? []),
    ...options.liveFrames
      .filter((frame) => frame.frequencyHz !== null)
      .map((frame) => frequencyToMidi(frame.frequencyHz!))
  ];
  const minMidi = visibleMidis.length > 0 ? Math.floor(Math.min(...visibleMidis)) - 1 : 48;
  const maxMidi = visibleMidis.length > 0 ? Math.ceil(Math.max(...visibleMidis)) + 1 : 72;

  const xForTime = (timeMs: number) =>
    padding.left +
    ((Math.min(Math.max(timeMs, viewport.startMs), viewport.endMs) - viewport.startMs) /
      Math.max(viewport.endMs - viewport.startMs, 1)) *
      plotWidth;
  const yForMidi = (midi: number) =>
    padding.top + (1 - (midi - minMidi) / Math.max(maxMidi - minMidi, 1)) * plotHeight;

  drawSongGrid(context, padding, plotWidth, plotHeight, xForTime, yForMidi, minMidi, maxMidi, viewport);
  drawScoreRegions(context, options.score, padding, plotHeight, xForTime, viewport);
  drawReferenceNotes(context, options.reference, xForTime, yForMidi, viewport);
  drawLiveContour(context, options.liveFrames, xForTime, yForMidi, viewport);
  drawPlayhead(context, options.currentTimeMs, padding, plotHeight, xForTime, viewport);

  context.fillStyle = "#6b6256";
  context.font = "600 12px system-ui, sans-serif";
  context.fillText(
    options.reference
      ? `Reference and live vocal · ${formatTime(viewport.startMs)}-${formatTime(viewport.endMs)}`
      : "Analyze a song section",
    padding.left,
    18
  );
}

type TimelineViewport = {
  startMs: number;
  endMs: number;
};

function createTimelineViewport(
  totalDurationMs: number,
  currentTimeMs: number,
  isPlaying: boolean
): TimelineViewport {
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

function drawSongGrid(
  context: CanvasRenderingContext2D,
  padding: { top: number; right: number; bottom: number; left: number },
  plotWidth: number,
  plotHeight: number,
  xForTime: (timeMs: number) => number,
  yForMidi: (midi: number) => number,
  minMidi: number,
  maxMidi: number,
  viewport: TimelineViewport
) {
  context.strokeStyle = "#e4ded4";
  context.lineWidth = 1;
  context.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

  for (let midi = Math.ceil(minMidi); midi <= Math.floor(maxMidi); midi += 1) {
    const y = yForMidi(midi);
    context.strokeStyle = midi % 12 === 0 ? "#d5cdc0" : "#eee8df";
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(padding.left + plotWidth, y);
    context.stroke();

    if (midi % 2 === 0) {
      context.fillStyle = "#83796d";
      context.font = "11px system-ui, sans-serif";
      context.fillText(midiToNoteName(midi), 10, y + 4);
    }
  }

  const visibleDurationMs = viewport.endMs - viewport.startMs;
  const tickMs = visibleDurationMs <= 6000 ? 1000 : 2000;
  const firstTickMs = Math.ceil(viewport.startMs / tickMs) * tickMs;
  for (let timeMs = firstTickMs; timeMs <= viewport.endMs; timeMs += tickMs) {
    const x = xForTime(timeMs);
    context.strokeStyle = "#ded6ca";
    context.beginPath();
    context.moveTo(x, padding.top);
    context.lineTo(x, padding.top + plotHeight);
    context.stroke();

    context.fillStyle = "#83796d";
    context.font = "10px system-ui, sans-serif";
    context.fillText(formatTime(timeMs), x - 11, padding.top + plotHeight + 17);
  }
}

function drawScoreRegions(
  context: CanvasRenderingContext2D,
  score: SongScore | null,
  padding: { top: number; right: number; bottom: number; left: number },
  plotHeight: number,
  xForTime: (timeMs: number) => number,
  viewport: TimelineViewport
) {
  if (!score) {
    return;
  }

  score.regions.forEach((region) => {
    if (region.status === "inTune") {
      return;
    }
    if (region.endMs < viewport.startMs || region.startMs > viewport.endMs) {
      return;
    }

    const x = xForTime(Math.max(region.startMs, viewport.startMs));
    const width = Math.max(4, xForTime(Math.min(region.endMs, viewport.endMs)) - x);
    context.fillStyle =
      region.status === "missed" || region.status === "unclear"
        ? "rgba(207, 93, 72, 0.14)"
        : "rgba(125, 76, 194, 0.13)";
    context.fillRect(x, padding.top, width, plotHeight);
  });
}

function drawReferenceNotes(
  context: CanvasRenderingContext2D,
  reference: SongReference | null,
  xForTime: (timeMs: number) => number,
  yForMidi: (midi: number) => number,
  viewport: TimelineViewport
) {
  if (!reference) {
    return;
  }

  context.lineWidth = 6;
  context.strokeStyle = "rgba(27, 148, 127, 0.78)";
  context.lineJoin = "round";
  context.lineCap = "round";
  reference.notes.forEach((note) => {
    if (note.endMs < viewport.startMs || note.startMs > viewport.endMs) {
      return;
    }

    const xStart = xForTime(Math.max(note.startMs, viewport.startMs));
    const xEnd = xForTime(Math.min(note.endMs, viewport.endMs));
    const y = yForMidi(note.medianMidi);
    context.beginPath();
    context.moveTo(xStart, y);
    context.lineTo(Math.max(xStart + 4, xEnd), y);
    context.stroke();
  });
}

function drawLiveContour(
  context: CanvasRenderingContext2D,
  frames: PitchFrame[],
  xForTime: (timeMs: number) => number,
  yForMidi: (midi: number) => number,
  viewport: TimelineViewport
) {
  context.lineWidth = 3;
  context.strokeStyle = "rgba(125, 76, 194, 0.62)";
  context.lineJoin = "round";
  context.lineCap = "round";
  drawMidiLine(
    context,
    frames.map((frame) => ({
      timeMs: frame.timeMs,
      midi: frame.frequencyHz === null ? null : frequencyToMidi(frame.frequencyHz)
    })),
    xForTime,
    yForMidi,
    viewport
  );
}

function drawPlayhead(
  context: CanvasRenderingContext2D,
  currentTimeMs: number,
  padding: { top: number; right: number; bottom: number; left: number },
  plotHeight: number,
  xForTime: (timeMs: number) => number,
  viewport: TimelineViewport
) {
  if (currentTimeMs < viewport.startMs || currentTimeMs > viewport.endMs) {
    return;
  }

  const x = xForTime(currentTimeMs);
  context.strokeStyle = "#1f6f64";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, padding.top);
  context.lineTo(x, padding.top + plotHeight);
  context.stroke();

  context.fillStyle = "#1f6f64";
  context.beginPath();
  context.moveTo(x, padding.top - 1);
  context.lineTo(x - 5, padding.top - 9);
  context.lineTo(x + 5, padding.top - 9);
  if (typeof context.closePath === "function") {
    context.closePath();
  }
  context.fill();
}

function drawMidiLine(
  context: CanvasRenderingContext2D,
  points: Array<{ timeMs: number; midi: number | null }>,
  xForTime: (timeMs: number) => number,
  yForMidi: (midi: number) => number,
  viewport: TimelineViewport
) {
  context.beginPath();
  let drawing = false;
  points.forEach((point) => {
    if (point.timeMs < viewport.startMs || point.timeMs > viewport.endMs) {
      drawing = false;
      return;
    }

    if (point.midi === null) {
      drawing = false;
      return;
    }

    const x = xForTime(point.timeMs);
    const y = yForMidi(point.midi);
    if (!drawing) {
      context.moveTo(x, y);
      drawing = true;
    } else {
      context.lineTo(x, y);
    }
  });
  context.stroke();
}

function formatTime(timeMs: number) {
  const totalSeconds = Math.max(0, Math.round(timeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
