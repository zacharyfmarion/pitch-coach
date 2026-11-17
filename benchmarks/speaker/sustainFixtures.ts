import { createSpeakerDemo } from "../../src/song/speakerDemo";
import { midiToFrequency } from "../../src/domain/music";

export const SUSTAIN_CASES = [
  { id: "guide-muted", guideGain: 0, harmonics: 0, detuneCents: 0, vibratoCents: 0 },
  { id: "matching-guide", guideGain: 0.35, harmonics: 0, detuneCents: 0, vibratoCents: 0 },
  { id: "matching-guide-thin-harmonics", guideGain: 0.35, harmonics: 0.25, detuneCents: 0, vibratoCents: 4 },
  { id: "matching-guide-rich-harmonics", guideGain: 0.35, harmonics: 1, detuneCents: 0, vibratoCents: 8 },
  { id: "guide-detuned-15-cents", guideGain: 0.35, harmonics: 0, detuneCents: 15, vibratoCents: 0 },
  { id: "guide-without-singer", guideGain: 0.35, harmonics: 0, detuneCents: 0, vibratoCents: 0, silent: true },
  { id: "backing-without-singer", guideGain: 0, harmonics: 0, detuneCents: 0, vibratoCents: 0, silent: true }
] as const;

export type SustainCase = { id: string; guideGain: number; harmonics: number; detuneCents: number; vibratoCents: number; silent?: boolean };

/** Exact demo playback with an independently generated singer (not a copied guide). */
export function createSustainMixture(scenario: SustainCase) {
  const { reference, separation } = createSpeakerDemo({ lowestMidi: 48, highestMidi: 72 });
  const sampleRate = 48000;
  const lead = sampleRate * 2;
  const length = lead + separation.vocals.left.length;
  const render = new Float32Array(length);
  const near = new Float32Array(length);
  const microphone = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const at = index < lead ? index % lead : index - lead;
    render[index] = separation.accompaniment.left[at] * 0.95 + (index >= lead ? separation.vocals.left[at] * scenario.guideGain : 0);
  }
  for (const note of reference.notes) {
    let phase = 1.1;
    for (let index = lead + Math.round(note.startMs / 1000 * sampleRate); index < lead + Math.round(note.endMs / 1000 * sampleRate); index += 1) {
      const elapsed = (index - lead) / sampleRate - note.startMs / 1000;
      const remaining = note.endMs / 1000 + lead / sampleRate - index / sampleRate;
      const hz = midiToFrequency(note.midi) * 2 ** ((scenario.detuneCents + scenario.vibratoCents * Math.sin(2 * Math.PI * 5 * elapsed)) / 1200);
      phase += 2 * Math.PI * hz / sampleRate;
      if (!scenario.silent) near[index] = 0.08 * (Math.sin(phase) + scenario.harmonics * (0.35 * Math.sin(2 * phase) + 0.2 * Math.sin(3 * phase))) * Math.min(1, elapsed / 0.02, remaining / 0.03);
    }
  }
  for (let index = 0; index < length; index += 1) {
    microphone[index] = near[index] + 0.65 * (render[index - 3120] ?? 0) + 0.15 * (render[index - 3361] ?? 0);
  }
  return { reference, render, near, microphone, sampleRate, leadMs: 2000 };
}
