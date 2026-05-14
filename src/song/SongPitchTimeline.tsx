import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PitchFrame } from "../domain/contracts";
import { frequencyToMidi, midiToNoteName } from "../domain/music";
import type { SongDebugEnergyPoint } from "./debugDiagnostics";
import { createSongTimelineViewport, type SongTimelineViewport } from "./timelineViewport";
import type { SongReference, SongScore } from "./types";

type SongPitchTimelineProps = {
  reference: SongReference | null;
  liveFrames: PitchFrame[];
  score: SongScore | null;
  totalDurationMs: number;
  currentTimeMs: number;
  isPlaying: boolean;
  theme: SongTimelineTheme;
  debugEnabled?: boolean;
  debugEnergy?: SongDebugEnergyPoint[];
};

export type SongTimelineTheme = "light" | "dark";

export function SongPitchTimeline({
  reference,
  liveFrames,
  score,
  totalDurationMs,
  currentTimeMs,
  isPlaying,
  theme,
  debugEnabled = false,
  debugEnergy = []
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
      theme,
      debugEnabled,
      debugEnergy,
      width: size.width,
      height: size.height
    });
  }, [
    currentTimeMs,
    debugEnabled,
    debugEnergy,
    isPlaying,
    liveFrames,
    reference,
    score,
    size.height,
    size.width,
    theme,
    totalDurationMs
  ]);

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

type SongTimelinePalette = {
  surface: string;
  statusText: string;
  gridBorder: string;
  gridLine: string;
  gridStrongLine: string;
  gridLabel: string;
  timeMarker: string;
  missedRegion: string;
  offPitchRegion: string;
  referenceBand: string;
  referenceBorder: string;
  referenceLine: string;
  liveLine: string;
  playhead: string;
  debugSurface: string;
  debugBorder: string;
  debugBar: string;
};

const songTimelinePalettes = {
  light: {
    surface: "#fcfbf7",
    statusText: "#6b6256",
    gridBorder: "#e4ded4",
    gridLine: "#eee8df",
    gridStrongLine: "#d5cdc0",
    gridLabel: "#83796d",
    timeMarker: "#ded6ca",
    missedRegion: "rgba(207, 93, 72, 0.14)",
    offPitchRegion: "rgba(125, 76, 194, 0.13)",
    referenceBand: "rgba(27, 148, 127, 0.18)",
    referenceBorder: "rgba(27, 148, 127, 0.58)",
    referenceLine: "rgba(27, 148, 127, 0.92)",
    liveLine: "rgba(125, 76, 194, 0.62)",
    playhead: "#1f6f64",
    debugSurface: "#f5efe6",
    debugBorder: "#dfd5c7",
    debugBar: "rgba(31, 111, 100, 0.46)"
  },
  dark: {
    surface: "#1f2420",
    statusText: "#cfc6b8",
    gridBorder: "#353d36",
    gridLine: "#2f3630",
    gridStrongLine: "#485044",
    gridLabel: "#b8afa2",
    timeMarker: "#40493f",
    missedRegion: "rgba(243, 161, 145, 0.18)",
    offPitchRegion: "rgba(185, 152, 239, 0.16)",
    referenceBand: "rgba(101, 200, 183, 0.18)",
    referenceBorder: "rgba(101, 200, 183, 0.62)",
    referenceLine: "rgba(101, 200, 183, 0.92)",
    liveLine: "rgba(185, 152, 239, 0.72)",
    playhead: "#65c8b7",
    debugSurface: "#252b26",
    debugBorder: "#485044",
    debugBar: "rgba(101, 200, 183, 0.54)"
  }
} satisfies Record<SongTimelineTheme, SongTimelinePalette>;

function drawSongTimeline(canvas: HTMLCanvasElement, options: DrawSongTimelineOptions) {
  const palette = songTimelinePalettes[options.theme];
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

  const debugStripHeight = options.debugEnabled ? 30 : 0;
  const padding = { top: 28, right: 24, bottom: 30, left: 54 };
  const plotWidth = Math.max(options.width - padding.left - padding.right, 1);
  const plotHeight = Math.max(options.height - padding.top - padding.bottom - debugStripHeight, 1);
  const viewport = createSongTimelineViewport(options.totalDurationMs, options.currentTimeMs, options.isPlaying);
  const visibleMidis = [
    ...(options.reference?.notes.flatMap((note) => [
      note.midi,
      note.medianMidi,
      ...note.pitchBends.map((bend) => bend.midi)
    ]) ?? []),
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

  const timeLabelY = padding.top + plotHeight + debugStripHeight + 17;
  drawSongGrid(
    context,
    padding,
    plotWidth,
    plotHeight,
    xForTime,
    yForMidi,
    minMidi,
    maxMidi,
    viewport,
    timeLabelY,
    palette
  );
  drawScoreRegions(context, options.score, padding, plotHeight, xForTime, viewport, palette);
  drawReferenceNotes(context, options.reference, xForTime, yForMidi, viewport, palette);
  drawLiveContour(context, options.liveFrames, xForTime, yForMidi, viewport, palette);
  if (options.debugEnabled) {
    drawVocalEnergyStrip(
      context,
      options.debugEnergy ?? [],
      padding.left,
      padding.top + plotHeight + 5,
      plotWidth,
      Math.max(18, debugStripHeight - 8),
      xForTime,
      viewport,
      palette
    );
  }
  drawPlayhead(context, options.currentTimeMs, padding, plotHeight, xForTime, viewport, palette);

  context.fillStyle = palette.statusText;
  context.font = "600 12px system-ui, sans-serif";
  context.fillText(
    options.reference
      ? `Reference and live vocal · ${formatTime(viewport.startMs)}-${formatTime(viewport.endMs)}`
      : "Analyze a song section",
    padding.left,
    18
  );
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
  viewport: SongTimelineViewport,
  timeLabelY: number,
  palette: SongTimelinePalette
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

  const visibleDurationMs = viewport.endMs - viewport.startMs;
  const tickMs = visibleDurationMs <= 6000 ? 1000 : 2000;
  const firstTickMs = Math.ceil(viewport.startMs / tickMs) * tickMs;
  for (let timeMs = firstTickMs; timeMs <= viewport.endMs; timeMs += tickMs) {
    const x = xForTime(timeMs);
    context.strokeStyle = palette.timeMarker;
    context.beginPath();
    context.moveTo(x, padding.top);
    context.lineTo(x, padding.top + plotHeight);
    context.stroke();

    context.fillStyle = palette.gridLabel;
    context.font = "10px system-ui, sans-serif";
    context.fillText(formatTime(timeMs), x - 11, timeLabelY);
  }
}

function drawScoreRegions(
  context: CanvasRenderingContext2D,
  score: SongScore | null,
  padding: { top: number; right: number; bottom: number; left: number },
  plotHeight: number,
  xForTime: (timeMs: number) => number,
  viewport: SongTimelineViewport,
  palette: SongTimelinePalette
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
        ? palette.missedRegion
        : palette.offPitchRegion;
    context.fillRect(x, padding.top, width, plotHeight);
  });
}

function drawReferenceNotes(
  context: CanvasRenderingContext2D,
  reference: SongReference | null,
  xForTime: (timeMs: number) => number,
  yForMidi: (midi: number) => number,
  viewport: SongTimelineViewport,
  palette: SongTimelinePalette
) {
  if (!reference) {
    return;
  }

  context.lineWidth = 6;
  context.strokeStyle = palette.referenceLine;
  context.lineJoin = "round";
  context.lineCap = "round";
  reference.notes.forEach((note) => {
    if (note.endMs < viewport.startMs || note.startMs > viewport.endMs) {
      return;
    }

    const xStart = xForTime(Math.max(note.startMs, viewport.startMs));
    const xEnd = xForTime(Math.min(note.endMs, viewport.endMs));
    const yTop = yForMidi(note.midi + 0.42);
    const yBottom = yForMidi(note.midi - 0.42);
    const height = Math.max(8, yBottom - yTop);
    context.fillStyle = palette.referenceBand;
    context.strokeStyle = palette.referenceBorder;
    context.lineWidth = 1;
    context.fillRect(xStart, yTop, Math.max(4, xEnd - xStart), height);
    context.strokeRect(xStart, yTop, Math.max(4, xEnd - xStart), height);

    const bendPoints =
      note.pitchBends.length > 0
        ? note.pitchBends.map((bend) => ({ timeMs: bend.timeMs, midi: bend.midi }))
        : [
            { timeMs: note.startMs, midi: note.midi },
            { timeMs: note.endMs, midi: note.midi }
          ];
    context.strokeStyle = palette.referenceLine;
    context.lineWidth = 2;
    context.beginPath();
    let drawing = false;
    bendPoints.forEach((point) => {
      if (point.timeMs < viewport.startMs || point.timeMs > viewport.endMs) {
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
    if (!drawing && note.startMs < viewport.startMs && note.endMs > viewport.endMs) {
      context.moveTo(xStart, yForMidi(note.medianMidi));
      context.lineTo(Math.max(xStart + 4, xEnd), yForMidi(note.medianMidi));
    }
    context.stroke();
  });
}

function drawLiveContour(
  context: CanvasRenderingContext2D,
  frames: PitchFrame[],
  xForTime: (timeMs: number) => number,
  yForMidi: (midi: number) => number,
  viewport: SongTimelineViewport,
  palette: SongTimelinePalette
) {
  context.lineWidth = 3;
  context.strokeStyle = palette.liveLine;
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
  viewport: SongTimelineViewport,
  palette: SongTimelinePalette
) {
  if (currentTimeMs < viewport.startMs || currentTimeMs > viewport.endMs) {
    return;
  }

  const x = xForTime(currentTimeMs);
  context.strokeStyle = palette.playhead;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, padding.top);
  context.lineTo(x, padding.top + plotHeight);
  context.stroke();

  context.fillStyle = palette.playhead;
  context.beginPath();
  context.moveTo(x, padding.top - 1);
  context.lineTo(x - 5, padding.top - 9);
  context.lineTo(x + 5, padding.top - 9);
  if (typeof context.closePath === "function") {
    context.closePath();
  }
  context.fill();
}

function drawVocalEnergyStrip(
  context: CanvasRenderingContext2D,
  energy: SongDebugEnergyPoint[],
  x: number,
  y: number,
  width: number,
  height: number,
  xForTime: (timeMs: number) => number,
  viewport: SongTimelineViewport,
  palette: SongTimelinePalette
) {
  context.fillStyle = palette.debugSurface;
  context.fillRect(x, y, width, height);
  context.strokeStyle = palette.debugBorder;
  context.lineWidth = 1;
  context.strokeRect(x, y, width, height);

  const visibleEnergy = energy.filter(
    (point) => point.timeMs >= viewport.startMs && point.timeMs <= viewport.endMs
  );
  const maxRms = Math.max(0.0001, ...visibleEnergy.map((point) => point.rms));

  context.fillStyle = palette.debugBar;
  visibleEnergy.forEach((point) => {
    const barHeight = Math.max(1, (point.rms / maxRms) * (height - 4));
    const barX = xForTime(point.timeMs);
    context.fillRect(barX, y + height - 2 - barHeight, 2, barHeight);
  });

  context.fillStyle = palette.statusText;
  context.font = "9px system-ui, sans-serif";
  context.fillText("vocal rms", x + 5, y + 10);
}

function drawMidiLine(
  context: CanvasRenderingContext2D,
  points: Array<{ timeMs: number; midi: number | null }>,
  xForTime: (timeMs: number) => number,
  yForMidi: (midi: number) => number,
  viewport: SongTimelineViewport
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
