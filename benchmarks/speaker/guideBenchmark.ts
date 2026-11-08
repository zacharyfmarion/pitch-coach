import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { CalibratedCancellation } from "../../src/audio/calibratedCancellation";
import { AEC_DELAY_SAMPLES, SpeakerCancellation, loadEchoCanceller, SPEAKER_PITCH_OPTIONS } from "../../src/audio/speakerCancellation";
import { StreamingPitch } from "../../src/audio/streamingPitch";
import { PitchyPitchDetectorAdapter } from "../../src/audio/pitchyDetector";
import { midiToFrequency } from "../../src/domain/music";
import type { PitchFrame } from "../../src/domain/contracts";
import { createSustainMixture, SUSTAIN_CASES, type SustainCase } from "./sustainFixtures";
import { ACOUSTIC_CASES, acousticEcho, calibrationRecording } from "./calibratedFixtures";
import { createMixture, resample, type Annotation } from "./fixtures";
import { combineCounts, measurePitch, summarize, type Counts } from "./metrics";

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const split = option("--split", "development");
if (!["development", "regression", "synthetic"].includes(split)) throw new Error("Choose development, regression, or synthetic.");
const ids = split === "development" ? Array.from({ length: 8 }, (_, i) => i + 1) : split === "regression" ? Array.from({ length: 32 }, (_, i) => i + 9) : [];
const module = await loadEchoCanceller();
const cases: unknown[] = [];
const counts: Record<string, Counts[]> = { clean: [], calibrated: [], aec3: [], "calibrated-silent": [], "aec3-silent": [] };
const timings: number[] = [];
const calibrationTimings: number[] = [];
const hashes: Record<string, string> = {};
let totalSeconds = 0, acceptedCalibrations = 0, refusedCalibrations = 0;
let syntheticVoiced = true, syntheticSilent = true, stableCalibration = true, stressRefused = true;
const round = (v: number) => Math.round(v * 10000) / 10000;

function track(microphone: Float32Array, left: Float32Array, right: Float32Array, processor?: { process(m: Float32Array, l: Float32Array, r: Float32Array): Float32Array }, delay = 0, timeIt = false) {
  const pitch = new StreamingPitch(new PitchyPitchDetectorAdapter(SPEAKER_PITCH_OPTIONS), { minFrequencyHz: 65, maxFrequencyHz: 1100 }, 48000, delay);
  const frames: PitchFrame[] = [];
  for (let start = 0; start < microphone.length; start += 480) {
    const begin = performance.now();
    const input = microphone.subarray(start, start + 480);
    frames.push(...pitch.push(processor ? processor.process(input, left.subarray(start, start + 480), right.subarray(start, start + 480)) : input, start));
    if (timeIt) timings.push(performance.now() - begin);
  }
  if (timeIt) totalSeconds += microphone.length / 48000;
  return frames;
}

function legacy(cal: ReturnType<typeof calibrationRecording>) {
  const processor = new SpeakerCancellation(module);
  // The comparator gets the same quiet probe before the existing backing lead-in.
  for (let i = 0; i < cal.microphone.length; i += 480) processor.process(cal.microphone.subarray(i, i + 480), cal.left.subarray(i, i + 480), cal.right.subarray(i, i + 480));
  const silence = new Float32Array(480);
  for (let i = 0; i < 50; i += 1) processor.process(silence, silence, silence);
  return processor;
}

if (split !== "regression") for (const room of ACOUSTIC_CASES) {
  const cal = calibrationRecording(room, 73);
  const start = performance.now();
  const filter = new CalibratedCancellation(cal.microphone, cal.left, cal.right);
  calibrationTimings.push(performance.now() - start);
  for (const scenario of SUSTAIN_CASES as readonly SustainCase[]) {
    filter.reset();
    const stress = ["clock-drift", "noisy-room", "clipped-speaker"].includes(room.id);
    if (!filter.quality.accepted) {
      refusedCalibrations += 1;
      if (!stress) stableCalibration = false;
      cases.push({ source: "synthetic", room: room.id, scenario: scenario.id, calibration: filter.quality, evaluated: false });
      continue;
    }
    acceptedCalibrations += 1;
    if (stress) stressRefused = false;
    const m = createSustainMixture(scenario);
    const echo = acousticEcho(m.render, m.render, room, 73);
    const microphone = m.near.map((sample, i) => sample + echo[i]);
    const old = legacy(cal);
    const outputs = { calibrated: track(microphone, m.render, m.render, filter, 0, true), aec3: track(microphone, m.render, m.render, old, AEC_DELAY_SAMPLES) };
    old.dispose();
    function measure(frames: PitchFrame[], from: number, to: number) {
      let total = 0, detected = 0, correct = 0;
      for (const frame of frames) {
        const t = frame.timeMs - m.leadMs;
        const note = m.reference.notes.find((note) => t >= note.startMs + from && t < note.startMs + to);
        if (!note) continue;
        total += 1;
        if (frame.frequencyHz === null) continue;
        detected += 1;
        const expected = midiToFrequency(note.midi) * 2 ** ((scenario.detuneCents + scenario.vibratoCents * Math.sin(2 * Math.PI * 5 * (t - note.startMs) / 1000)) / 1200);
        if (Math.abs(1200 * Math.log2(frame.frequencyHz / expected)) <= 50) correct += 1;
      }
      return { frames: total, detected: round(detected / total), recall50Cents: scenario.silent ? null : round(correct / total) };
    }
    const metrics = Object.fromEntries(Object.entries(outputs).map(([name, frames]) => [name, { onset: measure(frames, 70, 200), sustain: measure(frames, 300, 700), fullFalseRate: scenario.silent ? round(frames.filter((f) => f.frequencyHz !== null).length / frames.length) : null }]));
    const result = metrics.calibrated;
    if (scenario.silent) syntheticSilent &&= result.onset.detected <= 0.01 && result.sustain.detected <= 0.01 && result.fullFalseRate! <= 0.01;
    else syntheticVoiced &&= result.onset.recall50Cents! >= 0.95 && result.sustain.recall50Cents! >= 0.95;
    cases.push({ source: "synthetic", room: room.id, scenario: scenario.id, calibration: filter.quality, evaluated: true, metrics });
    console.log(room.id, scenario.id, JSON.stringify(result));
  }
}

for (const id of ids) {
  const file = await readFile(`.cache/speaker-benchmark/Audio/vocadito_${id}.wav`);
  const csv = await readFile(`.cache/speaker-benchmark/Annotations/F0/vocadito_${id}_f0.csv`, "utf8");
  hashes[`vocadito_${id}.wav`] = createHash("sha256").update(file).digest("hex");
  hashes[`vocadito_${id}_f0.csv`] = createHash("sha256").update(csv).digest("hex");
  const vocal = readWave(file).subarray(0, 12 * 48000);
  const truth = csv.trim().split(/\r?\n/).map((row) => row.split(",").map(Number) as Annotation);
  const m = createMixture(vocal, { id: "unison-guide", sirDb: 0, delayMs: 65, guide: true, guideSemitones: 0 }, id * 73);
  const end = 2000 + vocal.length / 48;
  const clean = measurePitch(track(m.near, m.left, m.right), truth, 2000, end);
  for (const room of ACOUSTIC_CASES.filter((r) => !["clock-drift", "noisy-room", "clipped-speaker"].includes(r.id)).map((r) => split === "regression" && r.nonlinear ? { ...r, nonlinear: 7.3 } : r)) {
    const cal = calibrationRecording(room, id * 73);
    const echo = acousticEcho(m.left, m.right, room, id * 73);
    const start = performance.now();
    const filter = new CalibratedCancellation(cal.microphone, cal.left, cal.right);
    calibrationTimings.push(performance.now() - start);
    for (const silent of [false, true]) {
      filter.reset();
      if (!filter.quality.accepted) { stableCalibration = false; refusedCalibrations += 1; cases.push({ source: id, room: room.id, silent, calibration: filter.quality, evaluated: false }); continue; }
      acceptedCalibrations += 1;
      const microphone = echo.map((sample, i) => sample + (silent ? 0 : m.near[i]));
      const labels = silent ? truth.map(([t]) => [t, 0] as Annotation) : truth;
      const old = legacy(cal);
      const fresh = measurePitch(track(microphone, m.left, m.right, filter, 0, true), labels, 2000, end);
      const previous = measurePitch(track(microphone, m.left, m.right, old, AEC_DELAY_SAMPLES), labels, 2000, end);
      old.dispose();
      counts[silent ? "calibrated-silent" : "calibrated"].push(fresh);
      counts[silent ? "aec3-silent" : "aec3"].push(previous);
      if (!silent) counts.clean.push(clean);
      cases.push({ source: id, room: room.id, silent, calibration: filter.quality, evaluated: true, clean: summarize(clean), calibrated: summarize(fresh), aec3: summarize(previous) });
    }
  }
  console.log(`Guide-on ${split}: vocadito_${id}`);
}
const summary = Object.fromEntries(Object.entries(counts).map(([name, values]) => [name, values.length ? summarize(combineCounts(values)) : null]));
const gates = {
  stableCalibration,
  ...(split !== "regression" ? { syntheticHeldNotes: syntheticVoiced, syntheticGuideOnly: syntheticSilent, stressCalibrationRefused: stressRefused } : {}),
  ...(ids.length ? { realPitchPreserved: summary.calibrated !== null && summary.clean !== null && summary.calibrated.pitchRecall50Cents! >= summary.clean.pitchRecall50Cents! - 0.03, realGuideOnlyFalseRate: summary["calibrated-silent"] !== null && summary["calibrated-silent"].falseVoicedRate! <= 0.01 } : {})
};
timings.sort((a, b) => a - b);
const report = { protocol: "calibrated-guide-v1", split, recordingIds: ids, hashes, thresholds: SPEAKER_PITCH_OPTIONS, acousticCases: ACOUSTIC_CASES, regressionNonlinearity: split === "regression" ? 7.3 : null, acceptedCalibrations, refusedCalibrations, gates, summary,
  compute: { realTimeFactor: timings.reduce((sum, v) => sum + v, 0) / (totalSeconds * 1000), p95BlockMs: timings[Math.floor(timings.length * 0.95)], maximumBlockMs: timings.at(-1), maximumCalibrationMs: Math.max(...calibrationTimings) }, cases };
await writeFile(option("--output", `.cache/speaker-benchmark/guide-${split}.json`), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ summary, gates, compute: report.compute }, null, 2));
if (args.includes("--check") && Object.values(gates).includes(false)) process.exitCode = 1;

function readWave(bytes: Buffer): Float32Array {
  let channels = 0, rate = 0;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const name = bytes.toString("ascii", offset, offset + 4), length = bytes.readUInt32LE(offset + 4);
    if (name === "fmt ") { if (bytes.readUInt16LE(offset + 8) !== 1 || bytes.readUInt16LE(offset + 22) !== 16) throw new Error("Expected PCM16 WAV"); channels = bytes.readUInt16LE(offset + 10); rate = bytes.readUInt32LE(offset + 12); }
    if (name === "data") {
      const audio = new Float32Array(length / 2 / channels);
      for (let i = 0; i < audio.length; i += 1) for (let c = 0; c < channels; c += 1) audio[i] += bytes.readInt16LE(offset + 8 + (i * channels + c) * 2) / 32768 / channels;
      return resample(audio, rate);
    }
    offset += 8 + length + (length % 2);
  }
  throw new Error("No WAV samples");
}
