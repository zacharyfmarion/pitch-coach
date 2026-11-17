import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { cpus, platform, arch } from "node:os";
import { createHash } from "node:crypto";
import { PitchyPitchDetectorAdapter } from "../../src/audio/pitchyDetector";
import { AEC_DELAY_SAMPLES, loadEchoCanceller, SpeakerCancellation, SPEAKER_PITCH_OPTIONS } from "../../src/audio/speakerCancellation";
import { StreamingPitch } from "../../src/audio/streamingPitch";
import { createMixture, LEAD_IN_SECONDS, resample, SAMPLE_RATE, SCENARIOS, type Annotation } from "./fixtures";
import { combineCounts, measurePitch, summarize, type Counts } from "./metrics";

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const split = option("--split", "development");
if (!["development", "held-out"].includes(split)) throw new Error("Use --split development or held-out");
if (args.includes("--tune") && split !== "development") throw new Error("Threshold tuning is restricted to the development split.");
const output = resolve(option("--output", `.cache/speaker-benchmark/${split}.json`));
const ids = split === "development" ? [1, 2, 3, 4, 5, 6, 7, 8] : Array.from({ length: 32 }, (_, i) => i + 9);
const cache = resolve(".cache/speaker-benchmark");
const module = await loadEchoCanceller();
const records: Array<{ id: number; scenario: string; mode: string; counts: Counts; milliseconds: number; p95BlockMs: number; maximumBlockMs: number }> = [];
const tuning: Record<string, Record<string, Counts[]>> = {};
const hashes: Record<string, string> = {};
let seconds = 0;

for (const id of ids) {
  const file = await readFile(`${cache}/Audio/vocadito_${id}.wav`).catch(() => { throw new Error("Run pnpm benchmark:speakers:prepare first."); });
  hashes[`vocadito_${id}.wav`] = createHash("sha256").update(file).digest("hex");
  const vocals = readWave(file).subarray(0, 12 * SAMPLE_RATE);
  const csv = await readFile(`${cache}/Annotations/F0/vocadito_${id}_f0.csv`, "utf8");
  hashes[`vocadito_${id}_f0.csv`] = createHash("sha256").update(csv).digest("hex");
  const truth = csv.trim().split(/\r?\n/).map((row) => row.split(",").map(Number) as Annotation);
  for (const scenario of SCENARIOS) {
    const mixture = createMixture(vocals, scenario, id * 73);
    seconds += mixture.microphone.length / SAMPLE_RATE;
    for (const mode of ["raw", "aec3"]) {
      const canceller = mode === "aec3" ? new SpeakerCancellation(module) : null;
      const detector = new StreamingPitch(new PitchyPitchDetectorAdapter(mode === "aec3" && !args.includes("--tune") ? SPEAKER_PITCH_OPTIONS : { clarityThreshold: 0.66, rmsThreshold: 0.005 }),
        { minFrequencyHz: 65, maxFrequencyHz: 1100 }, SAMPLE_RATE, canceller ? AEC_DELAY_SAMPLES : 0);
      const frames = [];
      const timings: number[] = [];
      try {
        for (let start = 0; start < mixture.microphone.length; start += 480) {
          const begin = performance.now();
          const mic = mixture.microphone.subarray(start, start + 480);
          const processed = canceller ? canceller.process(mic, mixture.left.subarray(start, start + 480), mixture.right.subarray(start, start + 480)) : mic;
          frames.push(...detector.push(processed, start));
          timings.push(performance.now() - begin);
        }
      } finally {
        canceller?.dispose();
      }
      const counts = measurePitch(frames, scenario.silent ? truth.map(([t]) => [t, 0]) : truth,
        LEAD_IN_SECONDS * 1000, LEAD_IN_SECONDS * 1000 + vocals.length / SAMPLE_RATE * 1000);
      if (split === "development" && mode === "aec3" && args.includes("--tune")) {
        for (const clarity of [0.66, 0.72, 0.8]) for (const rms of [0.005, 0.008, 0.012]) {
          const key = `clarity=${clarity},rms=${rms}`;
          tuning[key] ??= {};
          tuning[key][scenario.id] ??= [];
          tuning[key][scenario.id].push(measurePitch(frames.map((f) => ({ ...f, frequencyHz: f.clarity >= clarity && f.rms >= rms ? f.frequencyHz : null })),
            scenario.silent ? truth.map(([t]) => [t, 0]) : truth, LEAD_IN_SECONDS * 1000, LEAD_IN_SECONDS * 1000 + vocals.length / SAMPLE_RATE * 1000));
        }
      }
      const sorted = [...timings].sort((a, b) => a - b);
      records.push({ id, scenario: scenario.id, mode, counts,
        milliseconds: timings.reduce((sum, v) => sum + v, 0),
        p95BlockMs: sorted[Math.floor(sorted.length * 0.95)], maximumBlockMs: sorted.at(-1)! });
    }
  }
  console.log(`Evaluated vocadito_${id} (${split})`);
}

const scenarios = Object.fromEntries(SCENARIOS.map((scenario) => [scenario.id, Object.fromEntries(["raw", "aec3"].map((mode) => {
  const group = records.filter((r) => r.scenario === scenario.id && r.mode === mode);
  return [mode, summarize(combineCounts(group.map((r) => r.counts)))];
}))]));
const gates = {
  cleanPreserved: scenarios.clean.aec3.pitchRecall50Cents! >= scenarios.clean.raw.pitchRecall50Cents! - 0.03,
  equalBackingRecall: scenarios["backing-equal"].aec3.pitchRecall50Cents! >= 0.65,
  equalBackingImprovement: scenarios["backing-equal"].aec3.pitchRecall50Cents! - scenarios["backing-equal"].raw.pitchRecall50Cents! >= 0.4,
  loudBackingRecall: scenarios["backing-loud"].aec3.pitchRecall50Cents! >= 0.4,
  silentFalseRate: scenarios["singer-silent"].aec3.falseVoicedRate! <= 0.08,
  silentImprovement: scenarios["singer-silent"].aec3.falseVoicedRate! <= scenarios["singer-silent"].raw.falseVoicedRate! / 2
};
const results = {
  protocol: "speaker-benchmark-v1", split, recordingIds: ids, excerpt: "first 12 seconds", seedRule: "recording ID * 73",
  dataset: { doi: "10.5281/zenodo.5578807", archiveMd5: "dea40fd18f14d899643c4ba221b33a46", license: "CC-BY-4.0", hashes },
  conditions: { sampleRate: SAMPLE_RATE, blockSize: 480, leadInSeconds: LEAD_IN_SECONDS, aecDelaySamples: AEC_DELAY_SAMPLES,
    pitchWindowSamples: 4096, pitchHopSamples: 960, rawPitchOptions: { clarityThreshold: 0.66, rmsThreshold: 0.005 },
    aecPitchOptions: args.includes("--tune") ? { clarityThreshold: 0.66, rmsThreshold: 0.005 } : SPEAKER_PITCH_OPTIONS, boundsHz: [65, 1100], toleranceCents: 50 },
  environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model },
  uniqueMixtureSeconds: seconds,
  scenarios,
  gates,
  tuning: Object.fromEntries(Object.entries(tuning).map(([key, groups]) => [key, Object.fromEntries(Object.entries(groups).map(([scenario, counts]) => [scenario, summarize(combineCounts(counts))]))])),
  compute: Object.fromEntries(["raw", "aec3"].map((mode) => {
    const group = records.filter((r) => r.mode === mode);
    return [mode, { realTimeFactor: group.reduce((sum, r) => sum + r.milliseconds, 0) / (seconds * 1000),
      worstCaseP95BlockMs: Math.max(...group.map((r) => r.p95BlockMs)), maximumBlockMs: Math.max(...group.map((r) => r.maximumBlockMs)) }];
  })),
  cases: records.map(({ counts, ...r }) => ({ ...r, ...summarize(counts) }))
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(results, null, 2) + "\n");
console.table(Object.entries(scenarios).map(([scenario, modes]) => ({ scenario,
  rawRecall: modes.raw.pitchRecall50Cents?.toFixed(3), aecRecall: modes.aec3.pitchRecall50Cents?.toFixed(3),
  rawFalse: modes.raw.falseVoicedRate?.toFixed(3), aecFalse: modes.aec3.falseVoicedRate?.toFixed(3) })));
console.log(JSON.stringify(results.compute));
console.log(`Wrote ${output}`);
if (args.includes("--check")) {
  console.log("Prototype acceptance gates:", gates);
  if (Object.values(gates).includes(false)) process.exitCode = 1;
}

function readWave(bytes: Buffer): Float32Array {
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") throw new Error("Expected WAV file");
  let channels = 0, rate = 0, bits = 0, format = 0;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const name = bytes.toString("ascii", offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    if (name === "fmt ") {
      format = bytes.readUInt16LE(offset + 8); channels = bytes.readUInt16LE(offset + 10);
      rate = bytes.readUInt32LE(offset + 12); bits = bytes.readUInt16LE(offset + 22);
    }
    if (name === "data") {
      if (format !== 1 || bits !== 16 || channels < 1) throw new Error("Expected PCM16 WAV");
      const audio = new Float32Array(length / 2 / channels);
      for (let i = 0; i < audio.length; i += 1) {
        for (let channel = 0; channel < channels; channel += 1) audio[i] += bytes.readInt16LE(offset + 8 + (i * channels + channel) * 2) / 32768 / channels;
      }
      return resample(audio, rate);
    }
    offset += 8 + length + (length % 2);
  }
  throw new Error("No WAV samples found");
}
