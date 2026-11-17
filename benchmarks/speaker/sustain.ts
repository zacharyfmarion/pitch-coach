import { writeFile } from "node:fs/promises";
import { AEC_DELAY_SAMPLES, loadEchoCanceller, SpeakerCancellation, SPEAKER_PITCH_OPTIONS } from "../../src/audio/speakerCancellation";
import { StreamingPitch } from "../../src/audio/streamingPitch";
import { PitchyPitchDetectorAdapter } from "../../src/audio/pitchyDetector";
import { midiToFrequency } from "../../src/domain/music";
import type { PitchFrame } from "../../src/domain/contracts";
import { createSustainMixture, SUSTAIN_CASES, type SustainCase } from "./sustainFixtures";

const module = await loadEchoCanceller();
const results = [];
for (const scenario of SUSTAIN_CASES as readonly SustainCase[]) {
  const mixture = createSustainMixture(scenario);
  const aec = new SpeakerCancellation(module);
  const tracker = (delay = 0) => new StreamingPitch(new PitchyPitchDetectorAdapter(SPEAKER_PITCH_OPTIONS), { minFrequencyHz: 65, maxFrequencyHz: 1100 }, mixture.sampleRate, delay);
  const trackers = { microphone: tracker(), cancelled: tracker(AEC_DELAY_SAMPLES), cleanSinger: tracker() };
  const frames: Record<keyof typeof trackers, PitchFrame[]> = { microphone: [], cancelled: [], cleanSinger: [] };
  for (let index = 0; index < mixture.microphone.length; index += 480) {
    const microphone = mixture.microphone.subarray(index, index + 480);
    const render = mixture.render.subarray(index, index + 480);
    frames.microphone.push(...trackers.microphone.push(microphone, index));
    frames.cancelled.push(...trackers.cancelled.push(aec.process(microphone, render, render), index));
    frames.cleanSinger.push(...trackers.cleanSinger.push(mixture.near.subarray(index, index + 480), index));
  }
  aec.dispose();
  function measure(input: PitchFrame[], fromMs: number, toMs: number) {
    let count = 0, detected = 0, correct = 0, lowLevel = 0, rms = 0, clarity = 0;
    for (const frame of input) {
      const time = frame.timeMs - mixture.leadMs;
      const note = mixture.reference.notes.find((note) => time >= note.startMs + fromMs && time < note.startMs + toMs);
      if (!note) continue;
      const target = midiToFrequency(note.midi) * 2 ** ((scenario.detuneCents + scenario.vibratoCents * Math.sin(2 * Math.PI * 5 * (time - note.startMs) / 1000)) / 1200);
      count += 1;
      if (frame.frequencyHz !== null) {
        detected += 1;
        if (!scenario.silent && Math.abs(1200 * Math.log2(frame.frequencyHz / target)) <= 50) correct += 1;
      }
      if (frame.rms < SPEAKER_PITCH_OPTIONS.rmsThreshold) lowLevel += 1;
      rms += frame.rms;
      clarity += frame.clarity;
    }
    return { frames: count, detectionRate: detected / count, recall50Cents: scenario.silent ? null : correct / count, belowLevelRate: lowLevel / count, meanRms: rms / count, meanClarity: clarity / count };
  }
  const measurements = Object.fromEntries(Object.entries(frames).map(([name, input]) => [name, { onset: measure(input, 70, 200), sustain: measure(input, 300, 700) }]));
  results.push({ scenario, measurements });
  console.log(scenario.id, JSON.stringify(measurements.cancelled));
}
const output = process.argv[process.argv.indexOf("--output") + 1];
if (process.argv.includes("--output") && output) await writeFile(output, JSON.stringify({
  purpose: "Characterize known matching-guide suppression; not a passing acceptance test or measured human performance.",
  settings: { sampleRate: 48000, blockSize: 480, pitch: SPEAKER_PITCH_OPTIONS, aecVersion: "0.3.0", delaySamples: AEC_DELAY_SAMPLES, guideGain: 0.35, echoTaps: [[3120, 0.65], [3361, 0.15]] },
  results
}, null, 2) + "\n");
