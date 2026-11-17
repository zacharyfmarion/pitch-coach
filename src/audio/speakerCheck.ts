import {
  CALIBRATED_SAMPLE_RATE as RATE,
  CALIBRATION_SAMPLES,
  CALIBRATION_TRAIN_SAMPLES,
  CANCELLATION_BLOCK_SIZE as BLOCK,
  MIN_REDUCTION_DB,
  CalibratedCancellation,
  createCalibrationProbe,
  StereoEchoFilter,
  type CalibrationQuality
} from "./calibratedCancellation";
import { calculateRms, PitchyPitchDetectorAdapter } from "./pitchyDetector";
import { SPEAKER_PITCH_OPTIONS } from "./speakerSettings";
import { StreamingPitch } from "./streamingPitch";
import { fitShortEchoPath } from "./shortEchoPath";

const CHECK_NOTES = [220, 294, 370];
const NOTE_LENGTH = 28800;
export const SPEAKER_GUIDE_START = CALIBRATION_SAMPLES + RATE / 2;
export const SPEAKER_CHECK_SAMPLES = SPEAKER_GUIDE_START + CHECK_NOTES.length * NOTE_LENGTH;

export function createSpeakerCheck() {
  const probe = createCalibrationProbe();
  const left = new Float32Array(SPEAKER_CHECK_SAMPLES);
  left.set(probe.left);
  for (const [note, hz] of CHECK_NOTES.entries()) {
    for (let i = 0; i < NOTE_LENGTH; i++) {
      const envelope = Math.min(1, i / 960, (NOTE_LENGTH - i) / 960);
      left[SPEAKER_GUIDE_START + note * NOTE_LENGTH + i] = 0.13 * envelope * Math.sin(2 * Math.PI * hz * i / RATE);
    }
  }
  const right = left.slice();
  right.set(probe.right);
  return { left, right };
}

export function roomPitchDetector(rmsThreshold: number) {
  // Prefer the first strong autocorrelation peak when other pitched sound remains.
  return new PitchyPitchDetectorAdapter({ ...SPEAKER_PITCH_OPTIONS, rmsThreshold }, 0.77);
}

type SpeakerProcessor = {
  quality: CalibrationQuality;
  reset(): void;
  process(microphone: Float32Array, left: Float32Array, right: Float32Array): Float32Array;
};

function guideControls(residual: Float32Array, rmsThreshold: number) {
  const bounds = { minFrequencyHz: 65, maxFrequencyHz: 1100 };
  function track(hz?: number) {
    const tracker = new StreamingPitch(roomPitchDetector(rmsThreshold), bounds, RATE);
    const input = residual.slice();
    if (hz) {
      for (let i = 0; i < input.length; i++) input[i] += 0.05 * Math.sin(i * hz * 2 * Math.PI / RATE + 0.8);
    }
    return tracker.push(input, 0);
  }
  const silent = track();
  let worstHeldRecall = 1;
  for (const note of CHECK_NOTES) {
    for (const cents of [0, 25]) {
      const hz = note * 2 ** (cents / 1200);
      const frames = track(hz).filter((frame) => frame.timeMs >= 100);
      const correct = frames.filter((frame) => frame.frequencyHz !== null && Math.abs(1200 * Math.log2(frame.frequencyHz / hz)) <= 50);
      worstHeldRecall = Math.min(worstHeldRecall, correct.length / frames.length);
    }
  }
  return { guideFrames: silent.length, guideDetections: silent.filter((frame) => frame.frequencyHz !== null).length, worstHeldRecall };
}

export function calibrateSpeakers(microphone: Float32Array, left: Float32Array, right: Float32Array, ambientRms?: number): SpeakerProcessor {
  if ([microphone, left, right].some((channel) => channel.length !== SPEAKER_CHECK_SAMPLES)) throw new Error("Incomplete speaker check.");
  const training = (samples: Float32Array) => samples.subarray(0, CALIBRATION_SAMPLES);
  const original = new CalibratedCancellation(training(microphone), training(left), training(right));
  // The final 140 ms of the quiet gap is beyond the supported room tail.
  const quietGapRms = calculateRms(microphone.subarray(SPEAKER_GUIDE_START - 6720, SPEAKER_GUIDE_START));
  original.quality.ambientRms = ambientRms;
  original.quality.quietGapRms = quietGapRms;
  if (original.quality.failure && original.quality.failure !== "poor-match") return original;
  const guide = microphone.subarray(SPEAKER_GUIDE_START);
  if (guide.some((sample) => Math.abs(sample) >= 0.98)) {
    original.quality.accepted = false;
    original.quality.failure = "clipped";
    return original;
  }
  if (CHECK_NOTES.some((_, i) => calculateRms(guide.subarray(i * NOTE_LENGTH, (i + 1) * NOTE_LENGTH)) < 0.0001)) {
    original.quality.accepted = false;
    original.quality.failure = "weak-input";
    return original;
  }
  if (original.quality.accepted) {
    // The quiet gap has already flushed the probe echo. Try the real guide
    // notes through the same detector used during a normal, quiet-room take.
    const pitch = new StreamingPitch(new PitchyPitchDetectorAdapter(SPEAKER_PITCH_OPTIONS), { minFrequencyHz: 65, maxFrequencyHz: 1100 }, RATE);
    let detections = 0;
    for (let i = SPEAKER_GUIDE_START; i < microphone.length; i += BLOCK) {
      const block = (channel: Float32Array) => channel.subarray(i, i + BLOCK);
      const frames = pitch.push(original.process(block(microphone), block(left), block(right)), i);
      detections += frames.filter((frame) => frame.frequencyHz !== null).length;
    }
    original.reset();
    if (!detections) return original;
    original.quality.accepted = false;
    original.quality.failure = "poor-match";
  }

  if (Math.max(ambientRms ?? 0, quietGapRms) < original.quality.echoRms * 10 ** (-MIN_REDUCTION_DB / 20)) return original;
  const repeats = original.quality.repeats;
  if (repeats && [repeats.left, repeats.right].some((r) => Math.abs(r.shiftSamples) >= 2 && r.correlation > 0.5 && r.correlation - r.alignedCorrelation > 0.15)) return original;
  // Qualify the dense path first. Some rooms have only a few resolvable
  // reflections. Test that model if a dense estimate admitted ambient noise.
  for (const sparse of [false, true]) {
    const processor = qualifyRoomPath(microphone, left, right, original.quality, sparse);
    if (processor) return processor;
  }
  return original;
}

function qualifyRoomPath(microphone: Float32Array, left: Float32Array, right: Float32Array, quality: CalibrationQuality, sparse: boolean): SpeakerProcessor | undefined {
  const impulses = fitShortEchoPath(microphone, left, right, sparse);
  let filter = new StereoEchoFilter(impulses);
  const output = new Float32Array(BLOCK);
  function subtract(mic: Float32Array, l: Float32Array, r: Float32Array) {
    const echo = filter.process(l, r);
    for (let i = 0; i < BLOCK; i++) output[i] = mic[i] - echo[i];
    return output;
  }
  const residual = new Float32Array(SPEAKER_CHECK_SAMPLES);
  const warmStart = Math.floor(CALIBRATION_TRAIN_SAMPLES / BLOCK) * BLOCK;
  for (let start = warmStart; start < microphone.length; start += BLOCK) {
    const block = (channel: Float32Array) => channel.subarray(start, start + BLOCK);
    residual.set(subtract(block(microphone), block(left), block(right)), start);
  }
  const validationStart = CALIBRATION_TRAIN_SAMPLES + 33000;
  const heldOut = (channel: Float32Array) => channel.subarray(validationStart, CALIBRATION_SAMPLES);
  const residualRms = calculateRms(heldOut(residual));
  const echoRms = calculateRms(heldOut(microphone));
  const reductionDb = 20 * Math.log10(echoRms / Math.max(residualRms, 1e-9));
  const rmsThreshold = Math.max(SPEAKER_PITCH_OPTIONS.rmsThreshold, 2 * residualRms);
  // Require a predictive path and leave room for a moderately soft singing voice.
  if (!(reductionDb >= 10 && rmsThreshold <= 0.022)) return undefined;

  const controls = guideControls(residual.subarray(SPEAKER_GUIDE_START), rmsThreshold);
  const roomCheck = { ...controls, rmsThreshold, reductionDb };
  if (controls.guideDetections > 0 || controls.worstHeldRecall < 0.95) {
    quality.roomCheck = roomCheck;
    return undefined;
  }
  filter = new StereoEchoFilter(impulses);
  return {
    process: subtract,
    reset() { filter = new StereoEchoFilter(impulses); },
    quality: { ...quality, accepted: true, failure: null, nonlinearity: 0, denoised: false, echoRms, residualRms, reductionDb, roomCheck }
  };
}
