export const SAMPLE_RATE = 48000;
export const LEAD_IN_SECONDS = 2;
export type Annotation = [number, number];
export type Scenario = { id: string; sirDb?: number; delayMs: number; reverb?: boolean; guide?: boolean; guideSemitones?: number; silent?: boolean; nonlinear?: boolean; drift?: boolean };

export const SCENARIOS: Scenario[] = [
  { id: "clean", delayMs: 0 },
  { id: "backing-quiet", sirDb: 6, delayMs: 35 },
  { id: "backing-equal", sirDb: 0, delayMs: 65 },
  { id: "backing-loud", sirDb: -6, delayMs: 110 },
  { id: "reverberant", sirDb: 0, delayMs: 70, reverb: true },
  { id: "guide-vocal", sirDb: 0, delayMs: 65, guide: true },
  { id: "singer-silent", sirDb: 0, delayMs: 65, guide: true, silent: true },
  { id: "nonlinear-speaker", sirDb: 0, delayMs: 65, nonlinear: true },
  { id: "clock-drift", sirDb: 0, delayMs: 65, drift: true }
];

export function seededRandom(seed: number) {
  let state = seed | 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function rms(audio: Float32Array) {
  return Math.sqrt(audio.reduce((sum, sample) => sum + sample * sample, 0) / Math.max(1, audio.length));
}

export function createMixture(vocals: Float32Array, scenario: Scenario, seed: number) {
  const lead = LEAD_IN_SECONDS * SAMPLE_RATE;
  const length = Math.ceil((lead + vocals.length + SAMPLE_RATE) / 480) * 480;
  const near = new Float32Array(length);
  const normalization = 0.05 / Math.max(rms(vocals), 0.0001);
  if (!scenario.silent) near.set(vocals.map((v) => v * normalization), lead);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const random = seededRandom(seed);
  if (scenario.sirDb === undefined) return { near, microphone: near.slice(), left, right };

  // Independent, seeded music: changing major/minor chords, bass, and noise
  // percussion. No target f0 or expected notes are used to construct cancellation.
  const roots = [130.8128, 174.6141, 146.8324, 195.9977];
  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE;
    const root = roots[(Math.floor(t / 1.7) + seed) % roots.length];
    const beat = t % 0.43;
    const envelope = 0.3 + 0.7 * Math.exp(-beat * 7);
    const bass = Math.sin(2 * Math.PI * root / 2 * t) * 0.08;
    const third = Math.sin(2 * Math.PI * root * 2 ** ((seed % 2 ? 3 : 4) / 12) * t) * 0.06;
    const fifth = Math.sin(2 * Math.PI * root * 1.5 * t) * 0.05;
    const percussion = (random() - 0.5) * Math.exp(-beat * 65) * 0.15;
    left[i] = envelope * (bass + third) + percussion;
    right[i] = envelope * (bass + fifth) - percussion * 0.4;
    if (scenario.guide) {
      // A competing, two-semitones-higher voice, present in the known playback.
      const v = Math.floor(Math.max(0, i - lead) * 2 ** ((scenario.guideSemitones ?? 2) / 12)) % vocals.length;
      const guide = i >= lead && i < lead + vocals.length ? vocals[v] * normalization : 0;
      left[i] += guide * 1.2;
      right[i] += guide * 1.2;
    }
  }
  const echo = new Float32Array(length);
  const delay = Math.round(scenario.delayMs / 1000 * SAMPLE_RATE);
  const taps: [number, number, number][] = [[0, 0.8, 0.5], [241, 0.2, -0.15], [719, -0.12, 0.18], [1409, 0.09, 0.06]];
  if (scenario.reverb) {
    for (let n = 0; n < 80; n += 1) {
      taps.push([1700 + n * 151, (random() - 0.5) * 0.15 * Math.exp(-n / 25), (random() - 0.5) * 0.15 * Math.exp(-n / 25)]);
    }
  }
  for (let i = delay; i < length; i += 1) {
    const pos = (i - delay) * (scenario.drift ? 1.0002 : 1);
    for (const [offset, l, r] of taps) {
      const at = pos - offset;
      const j = Math.floor(at);
      if (j < 0 || j + 1 >= length) continue;
      const fraction = at - j;
      const value = l * (left[j] * (1 - fraction) + left[j + 1] * fraction) + r * (right[j] * (1 - fraction) + right[j + 1] * fraction);
      echo[i] += scenario.nonlinear ? Math.tanh(value * 8) / 8 : value;
    }
  }
  const ratio = 0.05 / 10 ** (scenario.sirDb / 20) / Math.max(rms(echo.subarray(lead, lead + vocals.length)), 0.0001);
  const microphone = near.map((value, i) => value + echo[i] * ratio + (random() - 0.5) * 0.0004);
  // Scaling the acoustic path does not alter the known digital render reference.
  return { near, microphone, left, right };
}

export function resample(input: Float32Array, fromRate: number, toRate = SAMPLE_RATE) {
  if (fromRate === toRate) return input;
  const output = new Float32Array(Math.round(input.length * toRate / fromRate));
  for (let i = 0; i < output.length; i += 1) {
    const position = i * fromRate / toRate;
    const index = Math.floor(position);
    output[i] = input[index] * (1 - position + index) + (input[index + 1] ?? input[index]) * (position - index);
  }
  return output;
}
