import {
  addPitchBendsToNoteEvents,
  noteFramesToTime,
  type NoteEventTime
} from "@spotify/basic-pitch";
import { midiToFrequency } from "../domain/music";
import { interpolateNoteMidi } from "./referenceContour";
import { REFERENCE_DETAIL_CONFIG } from "./transcriptionConfig";
import type {
  SongReference,
  SongReferenceContourPoint,
  SongReferenceDetail,
  SongReferenceFrame,
  SongReferenceNote,
  SongReferencePitchBend,
  SongPhrase
} from "./types";

const BASIC_PITCH_BINS_PER_SEMITONE = 3;
const BASIC_PITCH_MIDI_OFFSET = 21;
const BASIC_PITCH_SAMPLE_RATE = 22050;
const BASIC_PITCH_FFT_HOP = 256;
const BASIC_PITCH_FRAME_MS = (BASIC_PITCH_FFT_HOP / BASIC_PITCH_SAMPLE_RATE) * 1000;
const SMOOTHING_RADIUS_FRAMES = 2;
const LOW_CONFIDENCE_THRESHOLD = 0.18;
const REFERENCE_FRAME_STEP_MS = 80;

export type BasicPitchOutput = {
  frames: number[][];
  onsets: number[][];
  contours: number[][];
};

export type DecodeBasicPitchOptions = {
  durationMs: number;
  detail: SongReferenceDetail;
  lowestMidi: number;
  highestMidi: number;
};

export function decodeBasicPitchOutputToReference(
  output: BasicPitchOutput,
  options: DecodeBasicPitchOptions
): SongReference {
  const noteEvents = noteFramesToTime(
    addPitchBendsToNoteEvents(
      output.contours,
      createMonophonicNoteEvents(output, options)
    )
  );

  return createReferenceFromBasicPitchNotes(noteEvents, options);
}

export function createReferenceFromBasicPitchNotes(
  noteEvents: NoteEventTime[],
  options: DecodeBasicPitchOptions
): SongReference {
  const config = REFERENCE_DETAIL_CONFIG[options.detail];
  const notes = mergeAdjacentSamePitchNotes(
    noteEvents
      .map((note, index) => toReferenceNote(note, index))
      .filter((note) => note.endMs - note.startMs >= config.minNoteDurationMs)
      .filter((note) => note.midi >= options.lowestMidi && note.midi <= options.highestMidi)
      .sort((a, b) => a.startMs - b.startMs || a.midi - b.midi),
    config.maxSamePitchMergeGapMs
  ).map((note, index) => ({
    ...note,
    id: `note-${index}`
  }));
  const contour = createContourFromNotes(notes);
  const frames = createReferenceFrames(notes, options.durationMs);

  return {
    frames,
    notes,
    contour,
    phrases: createPhrasesFromNotes(notes),
    quality: createReferenceQuality(notes, options.detail),
    durationMs: options.durationMs
  };
}

function createMonophonicNoteEvents(
  output: BasicPitchOutput,
  options: DecodeBasicPitchOptions
): BasicPitchNoteEvent[] {
  const pickedFrames = pickDominantVocalFrames(output.frames, options);
  const stableFrames = removeShortVoicedRuns(pickedFrames, options);
  const bridgedFrames = fillShortUnvoicedGaps(stableFrames, options);
  const smoothedFrames = smoothPitchGlitches(bridgedFrames);
  return mergeAdjacentNoteEvents(segmentMonophonicFrames(smoothedFrames, output.onsets, options), options);
}

function pickDominantVocalFrames(
  frames: number[][],
  options: DecodeBasicPitchOptions
): MonophonicFrame[] {
  const config = REFERENCE_DETAIL_CONFIG[options.detail];
  return frames.map((frame) => {
    let bestMidi = -1;
    let bestAmplitude = 0;
    for (let midi = options.lowestMidi; midi <= options.highestMidi; midi += 1) {
      const amplitude = frame[midi - BASIC_PITCH_MIDI_OFFSET] ?? 0;
      if (amplitude > bestAmplitude) {
        bestAmplitude = amplitude;
        bestMidi = midi;
      }
    }

    return bestAmplitude >= config.frameThreshold
      ? {
          midi: bestMidi,
          amplitude: bestAmplitude
        }
      : null;
  });
}

function removeShortVoicedRuns(
  frames: MonophonicFrame[],
  options: DecodeBasicPitchOptions
): MonophonicFrame[] {
  const config = REFERENCE_DETAIL_CONFIG[options.detail];
  const cleaned = frames.slice();
  let index = 0;
  while (index < cleaned.length) {
    if (!cleaned[index]) {
      index += 1;
      continue;
    }

    const startIndex = index;
    while (index < cleaned.length && cleaned[index]) {
      index += 1;
    }

    if (index - startIndex < config.minStableFrames) {
      for (let frameIndex = startIndex; frameIndex < index; frameIndex += 1) {
        cleaned[frameIndex] = null;
      }
    }
  }

  return cleaned;
}

function fillShortUnvoicedGaps(
  frames: MonophonicFrame[],
  options: DecodeBasicPitchOptions
): MonophonicFrame[] {
  const config = REFERENCE_DETAIL_CONFIG[options.detail];
  const maxGapFrames = Math.round(config.maxGapFillMs / BASIC_PITCH_FRAME_MS);
  const bridged = frames.slice();
  let index = 0;

  while (index < bridged.length) {
    if (bridged[index]) {
      index += 1;
      continue;
    }

    const startIndex = index;
    while (index < bridged.length && !bridged[index]) {
      index += 1;
    }

    const previous = startIndex > 0 ? bridged[startIndex - 1] : null;
    const next = index < bridged.length ? bridged[index] : null;
    if (previous && next && index - startIndex <= maxGapFrames && Math.abs(previous.midi - next.midi) <= 2) {
      const bridgedMidi = Math.round((previous.midi + next.midi) / 2);
      const bridgedAmplitude = Math.min(previous.amplitude, next.amplitude) * 0.8;
      for (let frameIndex = startIndex; frameIndex < index; frameIndex += 1) {
        bridged[frameIndex] = {
          midi: bridgedMidi,
          amplitude: bridgedAmplitude
        };
      }
    }
  }

  return bridged;
}

function smoothPitchGlitches(frames: MonophonicFrame[]): MonophonicFrame[] {
  return frames.map((frame, index) => {
    if (!frame) {
      return null;
    }

    const midiCounts = new Map<number, number>();
    let amplitude = frame.amplitude;
    for (
      let frameIndex = Math.max(0, index - SMOOTHING_RADIUS_FRAMES);
      frameIndex <= Math.min(frames.length - 1, index + SMOOTHING_RADIUS_FRAMES);
      frameIndex += 1
    ) {
      const candidate = frames[frameIndex];
      if (!candidate) {
        continue;
      }

      midiCounts.set(candidate.midi, (midiCounts.get(candidate.midi) ?? 0) + 1);
      amplitude = Math.max(amplitude, candidate.amplitude);
    }

    let smoothedMidi = frame.midi;
    let smoothedCount = -1;
    midiCounts.forEach((count, midi) => {
      if (
        count > smoothedCount ||
        (count === smoothedCount && Math.abs(midi - frame.midi) < Math.abs(smoothedMidi - frame.midi))
      ) {
        smoothedMidi = midi;
        smoothedCount = count;
      }
    });

    return {
      midi: smoothedMidi,
      amplitude
    };
  });
}

function segmentMonophonicFrames(
  frames: MonophonicFrame[],
  onsets: number[][],
  options: DecodeBasicPitchOptions
): BasicPitchNoteEvent[] {
  const config = REFERENCE_DETAIL_CONFIG[options.detail];
  const notes: BasicPitchNoteEvent[] = [];
  let active: ActiveMonophonicNote | null = null;

  frames.forEach((frame, index) => {
    if (!frame) {
      if (active) {
        notes.push(toNoteEvent(active, index));
        active = null;
      }
      return;
    }

    if (!active) {
      active = {
        startFrame: index,
        pitchMidi: frame.midi,
        amplitudes: [frame.amplitude]
      };
      return;
    }

    const hasSamePitchOnset =
      frame.midi === active.pitchMidi &&
      active.amplitudes.length * BASIC_PITCH_FRAME_MS >= config.minNoteDurationMs &&
      isLocalOnsetPeak(onsets, index, frame.midi, config.onsetSplitThreshold);
    if (
      !hasSamePitchOnset &&
      (frame.midi === active.pitchMidi || !isStablePitchChange(frames, index, frame.midi, config.minStableFrames))
    ) {
      active.amplitudes.push(frame.amplitude);
      return;
    }

    notes.push(toNoteEvent(active, index));
    active = {
      startFrame: index,
      pitchMidi: frame.midi,
      amplitudes: [frame.amplitude]
    };
  });

  if (active) {
    notes.push(toNoteEvent(active, frames.length));
  }

  return notes.filter((note) => note.durationFrames * BASIC_PITCH_FRAME_MS >= config.minNoteDurationMs);
}

function isLocalOnsetPeak(
  onsets: number[][],
  frameIndex: number,
  midi: number,
  threshold: number
) {
  const pitchIndex = midi - BASIC_PITCH_MIDI_OFFSET;
  const onset = onsets[frameIndex]?.[pitchIndex] ?? 0;
  if (onset < threshold) {
    return false;
  }

  const previous = onsets[frameIndex - 1]?.[pitchIndex] ?? 0;
  const next = onsets[frameIndex + 1]?.[pitchIndex] ?? 0;
  return onset >= previous && onset >= next;
}

function isStablePitchChange(
  frames: MonophonicFrame[],
  startIndex: number,
  midi: number,
  requiredFrames: number
) {
  const endIndex = Math.min(frames.length, startIndex + requiredFrames);
  let matchingFrames = 0;
  for (let index = startIndex; index < endIndex; index += 1) {
    if (frames[index]?.midi === midi) {
      matchingFrames += 1;
    }
  }

  return matchingFrames >= Math.min(requiredFrames, endIndex - startIndex);
}

function toNoteEvent(note: ActiveMonophonicNote, endFrame: number): BasicPitchNoteEvent {
  return {
    startFrame: note.startFrame,
    durationFrames: endFrame - note.startFrame,
    pitchMidi: note.pitchMidi,
    amplitude: mean(note.amplitudes)
  };
}

function mergeAdjacentNoteEvents(
  notes: BasicPitchNoteEvent[],
  options: DecodeBasicPitchOptions
): BasicPitchNoteEvent[] {
  const maxGapFrames = Math.round(
    REFERENCE_DETAIL_CONFIG[options.detail].maxSamePitchMergeGapMs / BASIC_PITCH_FRAME_MS
  );
  const merged: BasicPitchNoteEvent[] = [];

  notes.forEach((note) => {
    const previous = merged.at(-1);
    const previousEndFrame = previous ? previous.startFrame + previous.durationFrames : 0;
    if (
      previous &&
      previous.pitchMidi === note.pitchMidi &&
      note.startFrame > previousEndFrame &&
      note.startFrame - previousEndFrame <= maxGapFrames
    ) {
      const previousDuration = previous.durationFrames;
      previous.durationFrames = note.startFrame + note.durationFrames - previous.startFrame;
      previous.amplitude = weightedAverage(
        previous.amplitude,
        previousDuration,
        note.amplitude,
        note.durationFrames
      );
      return;
    }

    merged.push({ ...note });
  });

  return merged;
}

function toReferenceNote(note: NoteEventTime, index: number): SongReferenceNote {
  const startMs = Math.max(0, note.startTimeSeconds * 1000);
  const durationMs = Math.max(0, note.durationSeconds * 1000);
  const endMs = startMs + durationMs;
  const pitchBends = toPitchBends(note, startMs, durationMs);
  const medianMidi = pitchBends.length > 0 ? median(pitchBends.map((bend) => bend.midi)) : note.pitchMidi;

  return {
    id: `note-${index}`,
    startMs,
    endMs,
    midi: note.pitchMidi,
    medianMidi,
    confidence: clamp01(note.amplitude),
    amplitude: clamp01(note.amplitude),
    pitchBends
  };
}

function toPitchBends(
  note: NoteEventTime,
  startMs: number,
  durationMs: number
): SongReferencePitchBend[] {
  if (!note.pitchBends || note.pitchBends.length === 0) {
    return [];
  }

  return note.pitchBends.map((bend, index) => {
    const offsetSemitones = bend / BASIC_PITCH_BINS_PER_SEMITONE;
    return {
      timeMs: startMs + (durationMs * index) / note.pitchBends!.length,
      midi: note.pitchMidi + offsetSemitones,
      offsetSemitones
    };
  });
}

function mergeAdjacentSamePitchNotes(
  notes: SongReferenceNote[],
  maxGapMs: number
): SongReferenceNote[] {
  const merged: SongReferenceNote[] = [];

  notes.forEach((note) => {
    const previous = merged.at(-1);
    if (
      previous &&
      Math.round(previous.midi) === Math.round(note.midi) &&
      note.startMs > previous.endMs &&
      note.startMs - previous.endMs <= maxGapMs
    ) {
      const previousDuration = previous.endMs - previous.startMs;
      const noteDuration = note.endMs - note.startMs;
      const combinedDuration = previousDuration + noteDuration;
      previous.endMs = note.endMs;
      previous.confidence = weightedAverage(previous.confidence, previousDuration, note.confidence, noteDuration);
      previous.amplitude = weightedAverage(previous.amplitude, previousDuration, note.amplitude, noteDuration);
      previous.pitchBends = [...previous.pitchBends, ...note.pitchBends];
      previous.medianMidi =
        combinedDuration === 0 || previous.pitchBends.length === 0
          ? previous.midi
          : median(previous.pitchBends.map((bend) => bend.midi));
      return;
    }

    merged.push({ ...note, pitchBends: [...note.pitchBends] });
  });

  return merged;
}

function createContourFromNotes(notes: SongReferenceNote[]): SongReferenceContourPoint[] {
  return notes.flatMap((note) => {
    if (note.pitchBends.length === 0) {
      return [
        {
          timeMs: note.startMs,
          midi: note.midi,
          confidence: note.confidence,
          noteId: note.id
        },
        {
          timeMs: note.endMs,
          midi: note.midi,
          confidence: note.confidence,
          noteId: note.id
        }
      ];
    }

    const points = note.pitchBends.map((bend) => ({
      timeMs: bend.timeMs,
      midi: bend.midi,
      confidence: note.confidence,
      noteId: note.id
    }));
    const lastPoint = points.at(-1);
    if (lastPoint && lastPoint.timeMs < note.endMs) {
      points.push({
        ...lastPoint,
        timeMs: note.endMs
      });
    }

    return points;
  });
}

function createReferenceFrames(notes: SongReferenceNote[], durationMs: number): SongReferenceFrame[] {
  const frames: SongReferenceFrame[] = [];
  for (let timeMs = 0; timeMs <= durationMs; timeMs += REFERENCE_FRAME_STEP_MS) {
    const note = notes.find((candidate) => timeMs >= candidate.startMs && timeMs <= candidate.endMs);
    if (!note) {
      frames.push({
        timeMs,
        frequencyHz: null,
        midi: null,
        clarity: 0,
        rms: 0
      });
      continue;
    }

    const midi = interpolateNoteMidi(note, timeMs);
    frames.push({
      timeMs,
      frequencyHz: midiToFrequency(midi),
      midi,
      clarity: note.confidence,
      rms: note.amplitude
    });
  }

  return frames;
}

function createPhrasesFromNotes(notes: SongReferenceNote[]): SongPhrase[] {
  const phrases: SongPhrase[] = [];
  let activeNotes: SongReferenceNote[] = [];

  const flush = () => {
    if (activeNotes.length > 0) {
      phrases.push({
        id: `phrase-${phrases.length}`,
        startMs: activeNotes[0].startMs,
        endMs: activeNotes.at(-1)!.endMs,
        medianMidi: median(activeNotes.map((note) => note.medianMidi))
      });
    }
    activeNotes = [];
  };

  notes.forEach((note) => {
    const previous = activeNotes.at(-1);
    if (previous && note.startMs - previous.endMs > 260) {
      flush();
    }

    activeNotes.push(note);
  });
  flush();

  return phrases;
}

function createReferenceQuality(notes: SongReferenceNote[], detail: SongReferenceDetail) {
  const lowConfidenceCount = notes.filter((note) => note.confidence < LOW_CONFIDENCE_THRESHOLD).length;
  const suggestion =
    notes.length < 4 && detail !== "sensitive"
      ? "Few notes detected. Try Sensitive detail if the vocal line is missing notes."
      : lowConfidenceCount > Math.max(2, notes.length / 3)
        ? "Several notes are low confidence. A cleaner vocal section may score more reliably."
        : null;

  return {
    noteCount: notes.length,
    lowConfidenceCount,
    suggestion
  };
}

function weightedAverage(a: number, aWeight: number, b: number, bWeight: number) {
  const total = aWeight + bWeight;
  return total === 0 ? (a + b) / 2 : (a * aWeight + b * bWeight) / total;
}

function mean(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

type BasicPitchNoteEvent = {
  startFrame: number;
  durationFrames: number;
  pitchMidi: number;
  amplitude: number;
  pitchBends?: number[];
};

type MonophonicFrame = {
  midi: number;
  amplitude: number;
} | null;

type ActiveMonophonicNote = {
  startFrame: number;
  pitchMidi: number;
  amplitudes: number[];
};
