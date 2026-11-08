import type { VocalRange } from "../domain/contracts";
import { midiToFrequency } from "../domain/music";
import { createStereoBuffer } from "./audioData";
import { SONG_REFERENCE_ANALYSIS_VERSION } from "./referenceVersion";
import type { SongReference, SongReferenceNote, SongSeparationResult } from "./types";

/** Original generated practice material; no dataset audio is shipped to users. */
export function createSpeakerDemo(range: VocalRange): { reference: SongReference; separation: SongSeparationResult } {
  const sampleRate = 48000;
  const durationMs = 19000;
  const length = durationMs / 1000 * sampleRate;
  const backing = new Float32Array(length);
  const guide = new Float32Array(length);
  const baseMidi = Math.max(48, Math.min(60, Math.round((range.lowestMidi + range.highestMidi) / 2) - 3));
  const melody = [0, 2, 4, 7, 4, 2, 0, 0, 0, 2, 4, 7, 4, 2, 0, 0];
  const notes: SongReferenceNote[] = melody.map((step, index) => ({
    id: `demo-${index}`, startMs: 2000 + index * 1000, endMs: 2800 + index * 1000,
    midi: baseMidi + step, medianMidi: baseMidi + step, confidence: 1, amplitude: 0.5, pitchBends: []
  }));
  const root = midiToFrequency(baseMidi - 12);
  for (let i = 0; i < length; i += 1) {
    const time = i / sampleRate;
    const beat = time % 0.5;
    backing[i] = (Math.sin(2 * Math.PI * root * time) * 0.07 + Math.sin(2 * Math.PI * root * 1.5 * time) * 0.035) * (0.3 + 0.7 * Math.exp(-beat * 8));
    const note = notes[Math.floor(time - 2)];
    if (note && time * 1000 <= note.endMs) {
      const elapsed = time - note.startMs / 1000;
      const envelope = Math.min(1, elapsed / 0.02, (note.endMs / 1000 - time) / 0.03);
      guide[i] = Math.sin(2 * Math.PI * midiToFrequency(note.midi) * elapsed) * 0.2 * Math.max(0, envelope);
    }
  }
  const accompaniment = createStereoBuffer(backing, backing, sampleRate);
  const vocals = createStereoBuffer(guide, guide, sampleRate);
  const silence = createStereoBuffer(new Float32Array(length), new Float32Array(length), sampleRate);
  return {
    reference: {
      analysisVersion: SONG_REFERENCE_ANALYSIS_VERSION, analysisRange: range, durationMs, notes, frames: [],
      contour: notes.flatMap((note) => [{ timeMs: note.startMs, midi: note.midi, confidence: 1, noteId: note.id }, { timeMs: note.endMs, midi: note.midi, confidence: 1, noteId: note.id }]),
      phrases: [{ id: "demo", startMs: 2000, endMs: 17800, medianMidi: baseMidi + 2 }],
      quality: { noteCount: notes.length, lowConfidenceCount: 0, suggestion: null }
    },
    separation: { accompaniment, vocals, stems: { vocals, bass: accompaniment, drums: silence, other: silence } }
  };
}
