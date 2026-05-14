import { frequencyToMidi, midiToFrequency } from "../domain/music";
import { stereoToMono } from "./audioData";
import type { ExtractReferencePitchOptions, SongPhrase, SongReference, SongReferenceFrame } from "./types";

const DEFAULT_FRAME_SIZE = 4096;
const DEFAULT_HOP_SIZE = 1024;
const MAX_PHRASE_GAP_MS = 260;
const MIN_PHRASE_FRAMES = 4;

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

  const smoothedFrames = rejectIsolatedOctaveGlitches(smoothReferenceFrames(frames));
  return {
    frames: smoothedFrames,
    phrases: extractSongPhrases(smoothedFrames),
    durationMs: vocal.durationMs
  };
}

export function smoothReferenceFrames(frames: SongReferenceFrame[]): SongReferenceFrame[] {
  return frames.map((frame, index) => {
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
}

export function extractSongPhrases(frames: SongReferenceFrame[]): SongPhrase[] {
  const phrases: SongPhrase[] = [];
  let activeFrames: SongReferenceFrame[] = [];

  const flush = () => {
    if (activeFrames.length >= MIN_PHRASE_FRAMES) {
      const voicedMidis = activeFrames
        .map((frame) => frame.midi)
        .filter((midi): midi is number => midi !== null);
      phrases.push({
        id: `phrase-${phrases.length}`,
        startMs: activeFrames[0].timeMs,
        endMs: activeFrames.at(-1)!.timeMs,
        medianMidi: median(voicedMidis)
      });
    }
    activeFrames = [];
  };

  frames.forEach((frame) => {
    if (frame.midi === null) {
      flush();
      return;
    }

    const previous = activeFrames.at(-1);
    if (previous && frame.timeMs - previous.timeMs > MAX_PHRASE_GAP_MS) {
      flush();
    }

    activeFrames.push(frame);
  });
  flush();

  return phrases;
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
