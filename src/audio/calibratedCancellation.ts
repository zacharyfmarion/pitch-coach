import FFT from "fft.js";
import { calculateRms } from "./pitchyDetector";

export const CALIBRATED_SAMPLE_RATE = 48000;
export const CANCELLATION_BLOCK_SIZE = 480;
const PERIOD = 32768;
const FILTER_LENGTH = 16384;
const FFT_SIZE = 1024;
export const CALIBRATION_TRAIN_SAMPLES = 4 * PERIOD;
export const CALIBRATION_SAMPLES = Math.ceil((CALIBRATION_TRAIN_SAMPLES + CALIBRATED_SAMPLE_RATE) / CANCELLATION_BLOCK_SIZE) * CANCELLATION_BLOCK_SIZE;

/** Repeatable broadband probe; no song pitch or singer data enters calibration. */
export function createCalibrationProbe(): { left: Float32Array; right: Float32Array } {
  const left = new Float32Array(CALIBRATION_SAMPLES);
  const right = new Float32Array(CALIBRATION_SAMPLES);
  const period = probePeriod(48271);
  left.set(period, 0); left.set(period, PERIOD);
  right.set(period, 2 * PERIOD); right.set(period, 3 * PERIOD);
  // Independent stereo input: fit nonlinearity on its first useful portion,
  // then qualify the model on the final portion, which is never used to fit.
  let state = 12731;
  const noise = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return ((state >>> 0) / 4294967296 - 0.5) * 0.4; };
  for (let i = CALIBRATION_TRAIN_SAMPLES; i < CALIBRATION_SAMPLES; i += 1) { left[i] = noise(); right[i] = noise(); }
  return { left, right };
}

function probePeriod(seed: number) {
  const fft = new FFT(PERIOD);
  const spectrum = new Float64Array(PERIOD * 2);
  let state = seed;
  for (let bin = 1; bin < PERIOD / 2; bin += 1) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    const phase = (state >>> 0) / 4294967296 * 2 * Math.PI;
    spectrum[bin * 2] = Math.cos(phase);
    spectrum[bin * 2 + 1] = Math.sin(phase);
  }
  fft.completeSpectrum(spectrum);
  const inverse = new Float64Array(PERIOD * 2);
  fft.inverseTransform(inverse, spectrum);
  const samples = Float32Array.from({ length: PERIOD }, (_, i) => inverse[i * 2]);
  const gain = 0.035 / calculateRms(samples);
  return samples.map((sample) => sample * gain);
}

/** Uniform partitioned overlap-add, 480-sample blocks. No extra sample delay. */
export class StereoEchoFilter {
  private readonly fft = new FFT(FFT_SIZE);
  private readonly filters: Float64Array[][];
  private readonly history: Float64Array[][];
  private readonly input = new Float64Array(FFT_SIZE);
  private readonly sum = new Float64Array(FFT_SIZE * 2);
  private readonly inverse = new Float64Array(FFT_SIZE * 2);
  private readonly tail = new Float64Array(CANCELLATION_BLOCK_SIZE);
  private readonly output = new Float32Array(CANCELLATION_BLOCK_SIZE);
  private position = 0;

  constructor(impulses: [Float32Array, Float32Array]) {
    const partitions = Math.ceil(Math.max(...impulses.map((h) => h.length)) / CANCELLATION_BLOCK_SIZE);
    this.filters = impulses.map((impulse) => Array.from({ length: partitions }, (_, part) => {
      this.input.fill(0);
      this.input.set(impulse.subarray(part * CANCELLATION_BLOCK_SIZE, (part + 1) * CANCELLATION_BLOCK_SIZE));
      const spectrum = new Float64Array(FFT_SIZE * 2);
      this.fft.realTransform(spectrum, this.input);
      this.fft.completeSpectrum(spectrum);
      return spectrum;
    }));
    this.history = impulses.map(() => Array.from({ length: partitions }, () => new Float64Array(FFT_SIZE * 2)));
  }

  process(left: Float32Array, right: Float32Array) {
    if (left.length !== CANCELLATION_BLOCK_SIZE || right.length !== CANCELLATION_BLOCK_SIZE) throw new Error("Expected 480 reference samples.");
    this.sum.fill(0);
    for (const [channel, samples] of [left, right].entries()) {
      this.input.fill(0); this.input.set(samples);
      this.fft.realTransform(this.history[channel][this.position], this.input);
      this.fft.completeSpectrum(this.history[channel][this.position]);
      for (let part = 0; part < this.filters[channel].length; part += 1) {
        const h = this.filters[channel][part];
        const x = this.history[channel][(this.position - part + this.filters[channel].length) % this.filters[channel].length];
        for (let i = 0; i < this.sum.length; i += 2) {
          this.sum[i] += x[i] * h[i] - x[i + 1] * h[i + 1];
          this.sum[i + 1] += x[i] * h[i + 1] + x[i + 1] * h[i];
        }
      }
    }
    this.fft.inverseTransform(this.inverse, this.sum);
    for (let i = 0; i < CANCELLATION_BLOCK_SIZE; i += 1) {
      this.output[i] = this.inverse[2 * i] + this.tail[i];
      this.tail[i] = this.inverse[2 * (i + CANCELLATION_BLOCK_SIZE)];
    }
    this.position = (this.position + 1) % this.filters[0].length;
    return this.output;
  }
}

export type CalibrationQuality = { echoRms: number; residualRms: number; reductionDb: number; accepted: boolean; nonlinearity: number };

export class CalibratedCancellation {
  private filter: StereoEchoFilter;
  private readonly impulses: [Float32Array, Float32Array];
  private readonly output = new Float32Array(CANCELLATION_BLOCK_SIZE);
  private readonly distortedLeft = new Float32Array(CANCELLATION_BLOCK_SIZE);
  private readonly distortedRight = new Float32Array(CANCELLATION_BLOCK_SIZE);
  readonly quality: CalibrationQuality;

  constructor(microphone: Float32Array, left: Float32Array, right: Float32Array) {
    if ([microphone, left, right].some((channel) => channel.length !== CALIBRATION_SAMPLES)) throw new Error("Incomplete speaker calibration.");
    const candidates = new Map<number, ReturnType<typeof evaluate>>();
    function evaluate(strength: number) {
      const l = distort(left, strength), r = distort(right, strength);
      const impulses: [Float32Array, Float32Array] = [estimatePath(l.subarray(PERIOD, 2 * PERIOD), microphone.subarray(PERIOD, 2 * PERIOD)), estimatePath(r.subarray(3 * PERIOD, 4 * PERIOD), microphone.subarray(3 * PERIOD, 4 * PERIOD))];
      const validation = new StereoEchoFilter(impulses);
      let inputEnergy = 0, errorEnergy = 0, samples = 0, fittingError = 0;
      // Only warm the reference history needed by validation. Earlier samples
      // cannot contribute through a finite 16384-sample causal filter.
      for (let start = Math.floor(CALIBRATION_TRAIN_SAMPLES / 480) * 480; start < CALIBRATION_SAMPLES; start += 480) {
        const prediction = validation.process(l.subarray(start, start + 480), r.subarray(start, start + 480));
        if (start < CALIBRATION_TRAIN_SAMPLES + FILTER_LENGTH) continue;
        for (let i = 0; i < prediction.length; i += 1) {
          const input = microphone[start + i], error = (input - prediction[i]) ** 2;
          if (start < CALIBRATION_TRAIN_SAMPLES + 32000) fittingError += error;
          else { inputEnergy += input * input; errorEnergy += error; samples += 1; }
        }
      }
      return { impulses, fittingError, echoRms: Math.sqrt(inputEnergy / samples), residualRms: Math.sqrt(errorEnergy / samples), strength };
    }
    const candidate = (strength: number) => {
      if (!candidates.has(strength)) candidates.set(strength, evaluate(strength));
      return candidates.get(strength)!;
    };
    let best = candidate(0);
    for (const strength of [4, 8, 12, 16]) { const next = candidate(strength); if (next.fittingError < best.fittingError) best = next; }
    for (const step of [2, 1, 0.5]) {
      const center = best.strength;
      for (const strength of [Math.max(0, center - step), Math.min(20, center + step)]) { const next = candidate(strength); if (next.fittingError < best.fittingError) best = next; }
    }
    // Avoid inventing a nonlinear response to explain random microphone noise.
    if (best.fittingError > candidate(0).fittingError * 0.95) best = candidate(0);
    const { echoRms, residualRms } = best;
    const reductionDb = 20 * Math.log10(Math.max(echoRms, 1e-9) / Math.max(residualRms, 1e-9));
    // Acceptance uses the FINAL, unused part of the independent probe, not the
    // segment used to choose a soft-saturation parameter.
    this.quality = { echoRms, residualRms, reductionDb, nonlinearity: best.strength, accepted: echoRms >= 0.0005 && reductionDb >= 22 && !microphone.some((v) => Math.abs(v) >= 0.98) };
    this.impulses = best.impulses;
    // New reference history; the browser leaves a quiet tail before practice.
    this.filter = new StereoEchoFilter(this.impulses);
  }

  process(microphone: Float32Array, left: Float32Array, right: Float32Array): Float32Array {
    if (!this.quality.accepted) throw new Error("Speaker calibration was not reliable. Stay quiet, check speaker and microphone levels, and try again, or use headphones.");
    if (microphone.length !== CANCELLATION_BLOCK_SIZE) throw new Error("Expected 480 microphone samples.");
    const echo = this.filter.process(distort(left, this.quality.nonlinearity, this.distortedLeft), distort(right, this.quality.nonlinearity, this.distortedRight));
    for (let i = 0; i < microphone.length; i += 1) this.output[i] = microphone[i] - echo[i];
    return this.output;
  }

  reset() { this.filter = new StereoEchoFilter(this.impulses); }
}

function distort(input: Float32Array, strength: number, output = new Float32Array(input.length)) {
  if (strength === 0) return input;
  for (let i = 0; i < input.length; i += 1) output[i] = Math.tanh(input[i] * strength) / strength;
  return output;
}

function estimatePath(reference: Float32Array, microphone: Float32Array): Float32Array {
  if (calculateRms(reference) < 0.001) throw new Error("Calibration playback was not captured. Try again or use headphones.");
  const fft = new FFT(PERIOD);
  const x = new Float64Array(PERIOD * 2), y = new Float64Array(PERIOD * 2), h = new Float64Array(PERIOD * 2);
  fft.realTransform(x, reference); fft.completeSpectrum(x);
  fft.realTransform(y, microphone); fft.completeSpectrum(y);
  let power = 0;
  for (let i = 0; i < x.length; i += 2) power += x[i] ** 2 + x[i + 1] ** 2;
  const regularizer = power / PERIOD * 0.0001;
  for (let i = 0; i < x.length; i += 2) {
    const denominator = x[i] ** 2 + x[i + 1] ** 2 + regularizer;
    h[i] = (y[i] * x[i] + y[i + 1] * x[i + 1]) / denominator;
    h[i + 1] = (y[i + 1] * x[i] - y[i] * x[i + 1]) / denominator;
  }
  const inverse = new Float64Array(PERIOD * 2);
  fft.inverseTransform(inverse, h);
  return Float32Array.from({ length: FILTER_LENGTH }, (_, i) => inverse[i * 2]);
}
