import FFT from "fft.js";
import { CALIBRATION_TRAIN_SAMPLES } from "./calibratedCancellation";

const FFT_LENGTH = 65536;
const TRAIN_END = 32000;
const TRAIN_START = 12000;
const RESPONSE_LENGTH = 1536;
const REFLECTION_LENGTH = 3072;
const MAX_DELAY = 11500;

/** Fit the simultaneous stereo noise burst. The final third is reserved for validation. */
export function fitShortEchoPath(microphone: Float32Array, left: Float32Array, right: Float32Array, sparse: boolean): [Float32Array, Float32Array] {
  const responseLength = sparse ? REFLECTION_LENGTH : RESPONSE_LENGTH;
  const fft = new FFT(FFT_LENGTH);
  const work = new Float64Array(FFT_LENGTH);
  const complex = () => new Float64Array(2 * FFT_LENGTH);
  function spectrum(samples: Float32Array | Float64Array, output: Float64Array) {
    work.fill(0);
    work.set(samples);
    fft.realTransform(output, work);
    fft.completeSpectrum(output);
  }
  const burst = (samples: Float32Array) => samples.subarray(CALIBRATION_TRAIN_SAMPLES, CALIBRATION_TRAIN_SAMPLES + TRAIN_END);
  const observation = burst(microphone);
  const references = [burst(left), burst(right)].map((samples) => {
    const bins = complex();
    spectrum(samples, bins);
    let energy = 0;
    for (let i = TRAIN_START; i < TRAIN_END; i++) energy += samples[i] ** 2;
    return { bins, step: 0.55 / Math.max(energy, 1e-9), firstTap: 0, impulse: new Float32Array(MAX_DELAY + responseLength) };
  });
  const residual = new Float64Array(TRAIN_END);
  residual.set(observation.subarray(TRAIN_START), TRAIN_START);
  const errorBins = complex(), prediction = complex(), product = complex(), inverse = complex();
  for (let iteration = 0; iteration < 8; iteration++) {
    spectrum(residual, errorBins);
    prediction.fill(0);
    for (const channel of references) {
      const x = channel.bins;
      // Cross-correlate the remaining error with this speaker's reference.
      for (let k = 0; k < product.length; k += 2) {
        product[k] = x[k] * errorBins[k] + x[k + 1] * errorBins[k + 1];
        product[k + 1] = x[k] * errorBins[k + 1] - x[k + 1] * errorBins[k];
      }
      fft.inverseTransform(inverse, product);
      if (iteration === 0) {
        let peak = 0;
        for (let lag = 1; lag < MAX_DELAY; lag++) {
          if (Math.abs(inverse[lag * 2]) > Math.abs(inverse[peak * 2])) peak = lag;
        }
        channel.firstTap = Math.max(0, peak - 128);
      }
      for (let i = channel.firstTap; i < channel.firstTap + responseLength; i++) {
        channel.impulse[i] += channel.step * inverse[i * 2];
      }
      spectrum(channel.impulse, product);
      for (let k = 0; k < prediction.length; k += 2) {
        prediction[k] += x[k] * product[k] - x[k + 1] * product[k + 1];
        prediction[k + 1] += x[k] * product[k + 1] + x[k + 1] * product[k];
      }
    }
    fft.inverseTransform(inverse, prediction);
    for (let i = TRAIN_START; i < TRAIN_END; i++) residual[i] = observation[i] - inverse[2 * i];
  }
  if (sparse) {
    // Median absolute deviation estimates coefficient noise in sparse paths.
    // Suppress unsupported reflections before they combine coherently on a note.
    for (const { impulse, firstTap } of references) {
      const support = impulse.subarray(firstTap, firstTap + responseLength);
      const magnitudes = support.map(Math.abs).sort();
      const cutoff = 5 * magnitudes[Math.floor(responseLength / 2)] / 0.6745;
      for (let i = 0; i < support.length; i++) {
        if (Math.abs(support[i]) < cutoff) support[i] = 0;
      }
    }
  }
  // Both channels share a partition history and can omit trailing zero partitions.
  const end = Math.max(...references.map((channel) => channel.firstTap)) + responseLength;
  return [references[0].impulse.slice(0, end), references[1].impulse.slice(0, end)];
}
