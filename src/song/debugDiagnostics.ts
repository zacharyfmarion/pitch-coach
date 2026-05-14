import { midiToNoteName } from "../domain/music";
import { samplesToMs } from "./audioData";
import { createSongTimelineViewport, type SongTimelineViewport } from "./timelineViewport";
import type { SongReference, SongReferenceNote, SongStereoBuffer } from "./types";

const ENERGY_STEP_MS = 80;

export type SongDebugEnergyPoint = {
  timeMs: number;
  rms: number;
  peak: number;
};

export type SongDebugNoteRow = {
  id: string;
  relativeStartMs: number;
  relativeEndMs: number;
  originalStartMs: number;
  originalEndMs: number;
  midi: number;
  noteName: string;
  confidence: number;
  amplitude: number;
};

export type SongDebugInfo = {
  viewport: SongTimelineViewport;
  originalViewport: SongTimelineViewport;
  visibleNotes: SongDebugNoteRow[];
  vocalEnergy: SongDebugEnergyPoint[];
  visibleEnergyPeak: number;
};

export type CreateSongDebugInfoOptions = {
  reference: SongReference | null;
  vocals: SongStereoBuffer | null;
  vocalEnergy?: SongDebugEnergyPoint[];
  totalDurationMs: number;
  currentTimeMs: number;
  isPlaying: boolean;
  trimStartMs: number;
};

export function createSongDebugInfo({
  reference,
  vocals,
  vocalEnergy: providedVocalEnergy,
  totalDurationMs,
  currentTimeMs,
  isPlaying,
  trimStartMs
}: CreateSongDebugInfoOptions): SongDebugInfo {
  const viewport = createSongTimelineViewport(totalDurationMs, currentTimeMs, isPlaying);
  const vocalEnergy = providedVocalEnergy ?? createVocalEnergyTrace(vocals);
  const visibleEnergy = vocalEnergy.filter(
    (point) => point.timeMs >= viewport.startMs && point.timeMs <= viewport.endMs
  );

  return {
    viewport,
    originalViewport: {
      startMs: trimStartMs + viewport.startMs,
      endMs: trimStartMs + viewport.endMs
    },
    visibleNotes: createVisibleNoteRows(reference, viewport, trimStartMs),
    vocalEnergy,
    visibleEnergyPeak: visibleEnergy.reduce((max, point) => Math.max(max, point.peak), 0)
  };
}

export function createVisibleNoteRows(
  reference: SongReference | null,
  viewport: SongTimelineViewport,
  trimStartMs: number
): SongDebugNoteRow[] {
  if (!reference) {
    return [];
  }

  return reference.notes
    .filter((note) => isNoteVisible(note, viewport))
    .map((note) => ({
      id: note.id,
      relativeStartMs: note.startMs,
      relativeEndMs: note.endMs,
      originalStartMs: trimStartMs + note.startMs,
      originalEndMs: trimStartMs + note.endMs,
      midi: note.midi,
      noteName: midiToNoteName(note.midi),
      confidence: note.confidence,
      amplitude: note.amplitude
    }));
}

export function createVocalEnergyTrace(
  vocals: SongStereoBuffer | null,
  stepMs = ENERGY_STEP_MS
): SongDebugEnergyPoint[] {
  if (!vocals || vocals.left.length === 0) {
    return [];
  }

  const stepSamples = Math.max(1, Math.round((vocals.sampleRate * stepMs) / 1000));
  const points: SongDebugEnergyPoint[] = [];
  for (let startSample = 0; startSample < vocals.left.length; startSample += stepSamples) {
    const endSample = Math.min(vocals.left.length, startSample + stepSamples);
    let squareSum = 0;
    let peak = 0;
    for (let sampleIndex = startSample; sampleIndex < endSample; sampleIndex += 1) {
      const sample = ((vocals.left[sampleIndex] ?? 0) + (vocals.right[sampleIndex] ?? 0)) / 2;
      squareSum += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
    }

    const sampleCount = Math.max(1, endSample - startSample);
    points.push({
      timeMs: samplesToMs(startSample + sampleCount / 2, vocals.sampleRate),
      rms: Math.sqrt(squareSum / sampleCount),
      peak
    });
  }

  return points;
}

function isNoteVisible(note: SongReferenceNote, viewport: SongTimelineViewport) {
  return note.endMs >= viewport.startMs && note.startMs <= viewport.endMs;
}
