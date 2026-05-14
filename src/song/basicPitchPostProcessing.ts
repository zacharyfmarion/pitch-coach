import {
  addPitchBendsToNoteEvents,
  noteFramesToTime,
  outputToNotesPoly,
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
const MIN_NOTE_DURATION_MS = 50;
const MAX_SAME_PITCH_MERGE_GAP_MS = 80;
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
  const config = REFERENCE_DETAIL_CONFIG[options.detail];
  const noteEvents = noteFramesToTime(
    addPitchBendsToNoteEvents(
      output.contours,
      outputToNotesPoly(
        cloneMatrix(output.frames),
        cloneMatrix(output.onsets),
        config.onsetThreshold,
        config.frameThreshold,
        config.minNoteFrames,
        true,
        midiToFrequency(options.highestMidi),
        midiToFrequency(options.lowestMidi),
        true
      )
    )
  );

  return createReferenceFromBasicPitchNotes(noteEvents, options);
}

export function createReferenceFromBasicPitchNotes(
  noteEvents: NoteEventTime[],
  options: DecodeBasicPitchOptions
): SongReference {
  const notes = mergeAdjacentSamePitchNotes(
    noteEvents
      .map((note, index) => toReferenceNote(note, index))
      .filter((note) => note.endMs - note.startMs >= MIN_NOTE_DURATION_MS)
      .filter((note) => note.midi >= options.lowestMidi && note.midi <= options.highestMidi)
      .sort((a, b) => a.startMs - b.startMs || a.midi - b.midi)
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

function mergeAdjacentSamePitchNotes(notes: SongReferenceNote[]): SongReferenceNote[] {
  const merged: SongReferenceNote[] = [];

  notes.forEach((note) => {
    const previous = merged.at(-1);
    if (
      previous &&
      Math.round(previous.midi) === Math.round(note.midi) &&
      note.startMs - previous.endMs <= MAX_SAME_PITCH_MERGE_GAP_MS
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

function cloneMatrix(matrix: number[][]) {
  return matrix.map((row) => [...row]);
}

function weightedAverage(a: number, aWeight: number, b: number, bWeight: number) {
  const total = aWeight + bWeight;
  return total === 0 ? (a + b) / 2 : (a * aWeight + b * bWeight) / total;
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
