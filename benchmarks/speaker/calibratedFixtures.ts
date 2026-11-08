import { createCalibrationProbe } from "../../src/audio/calibratedCancellation";
import { seededRandom } from "./fixtures";

export type AcousticCase = { id: string; delayMs: number; gain: number; tail?: boolean; noise?: number; nonlinear?: number; hardClip?: number; driftPpm?: number };
export const ACOUSTIC_CASES: AcousticCase[] = [
  { id: "short", delayMs: 35, gain: 0.5, noise: 0.0003 },
  { id: "room", delayMs: 65, gain: 1, tail: true, noise: 0.0003 },
  { id: "loud-room", delayMs: 110, gain: 2, tail: true, noise: 0.0003 },
  { id: "noisy-room", delayMs: 65, gain: 1, tail: true, noise: 0.002 },
  { id: "nonlinear", delayMs: 65, gain: 1, nonlinear: 6, noise: 0.0003 },
  { id: "clock-drift", delayMs: 65, gain: 1, driftPpm: 200, noise: 0.0003 },
  { id: "clipped-speaker", delayMs: 65, gain: 1, hardClip: 0.05, noise: 0.0003 }
];

/** Only the simulator knows these paths. Cancellation receives recorded probes. */
export function acousticEcho(left: Float32Array, right: Float32Array, room: AcousticCase, seed: number) {
  const random = seededRandom(seed);
  const delay = Math.round(room.delayMs * 48);
  const taps: Array<[number, number, number]> = [[0, 0.42, 0.27], [241, 0.13, -0.04], [719, -0.08, 0.12], [1409, 0.05, 0.08]];
  if (room.tail) for (let i = 0; i < 55; i += 1) taps.push([1800 + i * 173, (random() - 0.5) * 0.12 * Math.exp(-i / 18), (random() - 0.5) * 0.12 * Math.exp(-i / 18)]);
  const distort = (samples: Float32Array) => room.hardClip ? samples.map((value) => Math.max(-room.hardClip!, Math.min(room.hardClip!, value))) : room.nonlinear ? samples.map((value) => Math.tanh(value * room.nonlinear!) / room.nonlinear!) : samples;
  const l = distort(left), r = distort(right);
  const output = new Float32Array(left.length);
  for (let i = 0; i < output.length; i += 1) {
    const position = (i - delay) * (1 + (room.driftPpm ?? 0) / 1e6);
    for (const [offset, a, b] of taps) {
      const at = position - offset, index = Math.floor(at), fraction = at - index;
      if (index < 0 || index + 1 >= l.length) continue;
      output[i] += room.gain * (a * (l[index] * (1 - fraction) + l[index + 1] * fraction) + b * (r[index] * (1 - fraction) + r[index + 1] * fraction));
    }
    output[i] += (random() - 0.5) * (room.noise ?? 0) * Math.sqrt(12);
  }
  return output;
}

export function calibrationRecording(room: AcousticCase, seed: number) {
  const { left, right } = createCalibrationProbe();
  return { left, right, microphone: acousticEcho(left, right, room, seed) };
}
