import type { PitchFrame } from "../../src/domain/contracts";
import type { Annotation } from "./fixtures";

export type Counts = { voiced: number; correct: number; missed: number; unvoiced: number; falseVoiced: number; errors: number[] };

export function measurePitch(frames: PitchFrame[], truth: Annotation[], startMs: number, endMs: number): Counts {
  const counts: Counts = { voiced: 0, correct: 0, missed: 0, unvoiced: 0, falseVoiced: 0, errors: [] };
  let position = 0;
  for (const frame of frames) {
    if (frame.timeMs < startMs || frame.timeMs >= endMs) continue;
    const time = (frame.timeMs - startMs) / 1000;
    while (position + 1 < truth.length && Math.abs(truth[position + 1][0] - time) <= Math.abs(truth[position][0] - time)) position += 1;
    const expected = truth[position]?.[1] ?? 0;
    if (expected <= 0) {
      counts.unvoiced += 1;
      if (frame.frequencyHz !== null) counts.falseVoiced += 1;
    } else {
      counts.voiced += 1;
      if (frame.frequencyHz === null) counts.missed += 1;
      else {
        const cents = Math.abs(1200 * Math.log2(frame.frequencyHz / expected));
        counts.errors.push(cents);
        if (cents <= 50) counts.correct += 1;
      }
    }
  }
  return counts;
}

export function summarize(counts: Counts) {
  const sorted = [...counts.errors].sort((a, b) => a - b);
  return {
    voicedFrames: counts.voiced,
    unvoicedFrames: counts.unvoiced,
    pitchRecall50Cents: counts.voiced ? counts.correct / counts.voiced : null,
    missedVoicedRate: counts.voiced ? counts.missed / counts.voiced : null,
    falseVoicedRate: counts.unvoiced ? counts.falseVoiced / counts.unvoiced : null,
    medianAbsoluteCents: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null
  };
}

export function combineCounts(counts: Counts[]): Counts {
  return counts.reduce((total, c) => ({
    voiced: total.voiced + c.voiced, correct: total.correct + c.correct,
    missed: total.missed + c.missed, unvoiced: total.unvoiced + c.unvoiced,
    falseVoiced: total.falseVoiced + c.falseVoiced, errors: [...total.errors, ...c.errors]
  }), { voiced: 0, correct: 0, missed: 0, unvoiced: 0, falseVoiced: 0, errors: [] });
}
