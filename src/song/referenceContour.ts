import type { SongReference, SongReferenceNote } from "./types";

export function interpolateReferenceMidi(reference: SongReference, timeMs: number): number | null {
  const note = reference.notes.find((candidate) => timeMs >= candidate.startMs && timeMs <= candidate.endMs);
  return note ? interpolateNoteMidi(note, timeMs) : null;
}

export function interpolateNoteMidi(note: SongReferenceNote, timeMs: number): number {
  if (note.pitchBends.length === 0) {
    return note.midi;
  }

  if (timeMs <= note.pitchBends[0].timeMs) {
    return note.pitchBends[0].midi;
  }

  for (let index = 1; index < note.pitchBends.length; index += 1) {
    const previous = note.pitchBends[index - 1];
    const next = note.pitchBends[index];
    if (timeMs <= next.timeMs) {
      const spanMs = Math.max(next.timeMs - previous.timeMs, 1);
      const progress = (timeMs - previous.timeMs) / spanMs;
      return previous.midi + (next.midi - previous.midi) * progress;
    }
  }

  return note.pitchBends.at(-1)?.midi ?? note.midi;
}
