import { frequencyToMidi, midiToFrequency } from "../domain/music";
import { stereoToMono } from "./audioData";
import type {
  ExtractReferencePitchOptions,
  SongPhrase,
  SongReference,
  SongReferenceFrame,
  SongReferenceNote
} from "./types";

const DEFAULT_FRAME_SIZE = 4096;
const DEFAULT_HOP_SIZE = 1024;
const MAX_PHRASE_GAP_MS = 260;
const MIN_PHRASE_FRAMES = 4;
const MAX_BRIDGED_GAP_FRAMES = 2;
const MAX_BRIDGED_GAP_SEMITONES = 1.2;
const MAX_ISOLATED_JUMP_SEMITONES = 4.5;
const NOTE_SPLIT_SEMITONES = 0.85;
const NOTE_MERGE_SEMITONES = 0.45;
const MAX_NOTE_MERGE_GAP_MS = 140;
const MIN_NOTE_DURATION_MS = 90;
const MIN_NOTE_FRAMES = 3;

export function extractReferencePitch({
  vocal,
  detector,
  range,
  frameSize = DEFAULT_FRAME_SIZE,
  hopSize = DEFAULT_HOP_SIZE
}: ExtractReferencePitchOptions): SongReference {
  const mono = stereoToMono(vocal);
  const bounds = {
    minFrequencyHz: midiToFrequency(range.lowestMidi),
    maxFrequencyHz: midiToFrequency(range.highestMidi)
  };
  const frames: SongReferenceFrame[] = [];

  for (let offset = 0; offset + frameSize <= mono.length; offset += hopSize) {
    const timeMs = (offset / vocal.sampleRate) * 1000;
    const frame = detector.detectPitch(
      mono.subarray(offset, offset + frameSize),
      vocal.sampleRate,
      timeMs,
      bounds
    );
    frames.push(toReferenceFrame(frame));
  }

  const smoothedFrames = smoothReferenceFrames(frames);
  const notes = extractReferenceNotes(smoothedFrames);
  const noteLockedFrames = lockFramesToReferenceNotes(smoothedFrames, notes);

  return {
    frames: noteLockedFrames,
    notes,
    phrases: extractSongPhrases(noteLockedFrames),
    durationMs: vocal.durationMs
  };
}

export function smoothReferenceFrames(frames: SongReferenceFrame[]): SongReferenceFrame[] {
  const medianSmoothed = frames.map((frame, index) => {
    if (frame.midi === null) {
      return frame;
    }

    const midis = frames
      .slice(Math.max(0, index - 2), Math.min(frames.length, index + 3))
      .map((candidate) => candidate.midi)
      .filter((midi): midi is number => midi !== null);

    if (midis.length < 3) {
      return frame;
    }

    const midi = median(midis);
    return {
      ...frame,
      midi,
      frequencyHz: midiToFrequency(midi)
    };
  });

  return bridgeShortUnvoicedGaps(rejectIsolatedVoicedFrames(rejectIsolatedOctaveGlitches(medianSmoothed)));
}

export function extractReferenceNotes(frames: SongReferenceFrame[]): SongReferenceNote[] {
  const notes: SongReferenceNote[] = [];
  let activeFrames: Array<SongReferenceFrame & { midi: number }> = [];

  const flush = () => {
    if (activeFrames.length >= MIN_NOTE_FRAMES) {
      const startMs = activeFrames[0].timeMs;
      const endMs = activeFrames.at(-1)!.timeMs + estimateFrameStepMs(activeFrames);
      if (endMs - startMs >= MIN_NOTE_DURATION_MS) {
        notes.push({
          id: `note-${notes.length}`,
          startMs,
          endMs,
          medianMidi: median(activeFrames.map((frame) => frame.midi))
        });
      }
    }
    activeFrames = [];
  };

  frames.forEach((frame) => {
    if (frame.midi === null) {
      flush();
      return;
    }

    const currentMedian =
      activeFrames.length === 0 ? frame.midi : median(activeFrames.map((activeFrame) => activeFrame.midi));
    if (
      activeFrames.length >= MIN_NOTE_FRAMES &&
      Math.abs(frame.midi - currentMedian) > NOTE_SPLIT_SEMITONES
    ) {
      flush();
    }

    activeFrames.push(frame as SongReferenceFrame & { midi: number });
  });
  flush();

  return mergeAdjacentNotes(notes).map((note, index) => ({
    ...note,
    id: `note-${index}`
  }));
}

export function extractSongPhrases(frames: SongReferenceFrame[]): SongPhrase[] {
  const phrases: SongPhrase[] = [];
  let activeFrames: Array<SongReferenceFrame & { midi: number }> = [];
  let lastVoicedFrame: (SongReferenceFrame & { midi: number }) | null = null;

  const flush = () => {
    if (activeFrames.length >= MIN_PHRASE_FRAMES) {
      phrases.push({
        id: `phrase-${phrases.length}`,
        startMs: activeFrames[0].timeMs,
        endMs: activeFrames.at(-1)!.timeMs,
        medianMidi: median(activeFrames.map((frame) => frame.midi))
      });
    }
    activeFrames = [];
    lastVoicedFrame = null;
  };

  frames.forEach((frame) => {
    if (frame.midi === null) {
      return;
    }

    if (lastVoicedFrame && frame.timeMs - lastVoicedFrame.timeMs > MAX_PHRASE_GAP_MS) {
      flush();
    }

    activeFrames.push(frame as SongReferenceFrame & { midi: number });
    lastVoicedFrame = frame as SongReferenceFrame & { midi: number };
  });
  flush();

  return phrases;
}

function lockFramesToReferenceNotes(
  frames: SongReferenceFrame[],
  notes: SongReferenceNote[]
): SongReferenceFrame[] {
  if (notes.length === 0) {
    return frames.map((frame) =>
      frame.midi === null
        ? frame
        : {
            ...frame,
            frequencyHz: null,
            midi: null
          }
    );
  }

  return frames.map((frame) => {
    if (frame.midi === null) {
      return frame;
    }

    const note = notes.find((candidate) => frame.timeMs >= candidate.startMs && frame.timeMs <= candidate.endMs);
    if (!note) {
      return {
        ...frame,
        frequencyHz: null,
        midi: null
      };
    }

    return {
      ...frame,
      frequencyHz: midiToFrequency(note.medianMidi),
      midi: note.medianMidi
    };
  });
}

function bridgeShortUnvoicedGaps(frames: SongReferenceFrame[]) {
  const bridged = frames.map((frame) => ({ ...frame }));
  let index = 0;

  while (index < bridged.length) {
    if (bridged[index].midi !== null) {
      index += 1;
      continue;
    }

    const gapStart = index;
    while (index < bridged.length && bridged[index].midi === null) {
      index += 1;
    }

    const gapEnd = index - 1;
    const previous = bridged[gapStart - 1];
    const next = bridged[index];
    const gapLength = gapEnd - gapStart + 1;
    if (
      gapLength > MAX_BRIDGED_GAP_FRAMES ||
      !previous ||
      !next ||
      previous.midi === null ||
      next.midi === null ||
      Math.abs(previous.midi - next.midi) > MAX_BRIDGED_GAP_SEMITONES
    ) {
      continue;
    }

    for (let gapIndex = gapStart; gapIndex <= gapEnd; gapIndex += 1) {
      const progress = (gapIndex - gapStart + 1) / (gapLength + 1);
      const midi = previous.midi + (next.midi - previous.midi) * progress;
      bridged[gapIndex] = {
        ...bridged[gapIndex],
        frequencyHz: midiToFrequency(midi),
        midi,
        clarity: Math.min(previous.clarity, next.clarity),
        rms: Math.min(previous.rms, next.rms)
      };
    }
  }

  return bridged;
}

function rejectIsolatedVoicedFrames(frames: SongReferenceFrame[]) {
  if (frames.length < 3) {
    return frames;
  }

  return frames.map((frame, index) => {
    if (frame.midi === null) {
      return frame;
    }

    const previous = findNearestVoicedFrame(frames, index, -1, 2);
    const next = findNearestVoicedFrame(frames, index, 1, 2);
    if (!previous || !next) {
      return frame;
    }

    const neighborsAgree = Math.abs(previous.midi - next.midi) <= MAX_BRIDGED_GAP_SEMITONES;
    const isolatedJump =
      Math.abs(frame.midi - previous.midi) > MAX_ISOLATED_JUMP_SEMITONES &&
      Math.abs(frame.midi - next.midi) > MAX_ISOLATED_JUMP_SEMITONES;
    if (!neighborsAgree || !isolatedJump) {
      return frame;
    }

    return {
      ...frame,
      frequencyHz: null,
      midi: null
    };
  });
}

function findNearestVoicedFrame(
  frames: SongReferenceFrame[],
  startIndex: number,
  direction: -1 | 1,
  maxDistance: number
): (SongReferenceFrame & { midi: number }) | null {
  for (let distance = 1; distance <= maxDistance; distance += 1) {
    const frame = frames[startIndex + direction * distance];
    if (frame?.midi !== null && frame?.midi !== undefined) {
      return frame as SongReferenceFrame & { midi: number };
    }
  }

  return null;
}

function mergeAdjacentNotes(notes: SongReferenceNote[]) {
  const merged: SongReferenceNote[] = [];
  notes.forEach((note) => {
    const previous = merged.at(-1);
    if (
      previous &&
      note.startMs - previous.endMs <= MAX_NOTE_MERGE_GAP_MS &&
      Math.abs(note.medianMidi - previous.medianMidi) <= NOTE_MERGE_SEMITONES
    ) {
      const previousDuration = previous.endMs - previous.startMs;
      const noteDuration = note.endMs - note.startMs;
      const combinedDuration = previousDuration + noteDuration;
      previous.medianMidi =
        combinedDuration === 0
          ? median([previous.medianMidi, note.medianMidi])
          : (previous.medianMidi * previousDuration + note.medianMidi * noteDuration) / combinedDuration;
      previous.endMs = note.endMs;
      return;
    }

    merged.push({ ...note });
  });

  return merged;
}

function estimateFrameStepMs(frames: SongReferenceFrame[]) {
  if (frames.length < 2) {
    return 80;
  }

  return Math.max(24, frames.at(-1)!.timeMs - frames.at(-2)!.timeMs);
}

function rejectIsolatedOctaveGlitches(frames: SongReferenceFrame[]) {
  if (frames.length < 3) {
    return frames;
  }

  return frames.map((frame, index) => {
    if (index === 0 || index === frames.length - 1 || frame.midi === null) {
      return frame;
    }

    const previous = frames[index - 1];
    const next = frames[index + 1];
    if (previous.midi === null || next.midi === null) {
      return frame;
    }

    const neighborsAgree = Math.abs(previous.midi - next.midi) < 1.2;
    const frameDisagrees =
      Math.abs(frame.midi - previous.midi) > 7 && Math.abs(frame.midi - next.midi) > 7;
    if (!neighborsAgree || !frameDisagrees) {
      return frame;
    }

    const midi = (previous.midi + next.midi) / 2;
    return {
      ...frame,
      midi,
      frequencyHz: midiToFrequency(midi)
    };
  });
}

function toReferenceFrame(frame: {
  timeMs: number;
  frequencyHz: number | null;
  clarity: number;
  rms: number;
}): SongReferenceFrame {
  return {
    ...frame,
    midi: frame.frequencyHz === null ? null : frequencyToMidi(frame.frequencyHz)
  };
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}
