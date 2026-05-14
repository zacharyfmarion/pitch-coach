import { describe, expect, it } from "vitest";
import type { PitchDetectorAdapter } from "../audio/types";
import { PitchyPitchDetectorAdapter } from "../audio/pitchyDetector";
import { midiToFrequency } from "../domain/music";
import { createStereoBuffer } from "./audioData";
import { extractReferencePitch, extractSongPhrases, smoothReferenceFrames } from "./referencePitch";
import type { SongReferenceFrame } from "./types";

describe("song reference pitch extraction", () => {
  it("extracts a clear vocal contour from a synthetic sung note", () => {
    const sampleRate = 44100;
    const frequencyHz = midiToFrequency(60);
    const samples = sineWave(frequencyHz, sampleRate, 1200);
    const reference = extractReferencePitch({
      vocal: createStereoBuffer(samples, samples, sampleRate),
      detector: new PitchyPitchDetectorAdapter({ clarityThreshold: 0.6, rmsThreshold: 0.001 }),
      range: { lowestMidi: 48, highestMidi: 72 }
    });

    const voiced = reference.frames.filter((frame) => frame.midi !== null);
    expect(voiced.length).toBeGreaterThan(20);
    expect(reference.phrases).toHaveLength(1);
    expect(reference.phrases[0].medianMidi).toBeCloseTo(60, 0);
  });

  it("keeps vibrato in one phrase and splits across silence gaps", () => {
    const detector: PitchDetectorAdapter = {
      detectPitch: (_samples, _sampleRate, timeMs) => ({
        timeMs,
        frequencyHz:
          timeMs > 700 && timeMs < 1300
            ? null
            : midiToFrequency(60 + Math.sin(timeMs / 80) * 0.22),
        clarity: 0.9,
        rms: timeMs > 700 && timeMs < 1300 ? 0.001 : 0.05
      })
    };
    const samples = new Float32Array(44100 * 2);
    const reference = extractReferencePitch({
      vocal: createStereoBuffer(samples, samples, 44100),
      detector,
      range: { lowestMidi: 48, highestMidi: 72 }
    });

    expect(reference.phrases).toHaveLength(2);
    expect(reference.phrases[0].endMs).toBeLessThan(reference.phrases[1].startMs);
  });

  it("smooths an isolated octave glitch in a reference contour", () => {
    const frames: SongReferenceFrame[] = [
      referenceFrame(0, 60),
      referenceFrame(100, 60.1),
      referenceFrame(200, 72),
      referenceFrame(300, 60.05),
      referenceFrame(400, 60)
    ];

    const smoothed = smoothReferenceFrames(frames);
    expect(smoothed[2].midi).toBeCloseTo(60.05, 1);
    expect(extractSongPhrases(smoothed)).toHaveLength(1);
  });
});

function referenceFrame(timeMs: number, midi: number): SongReferenceFrame {
  return {
    timeMs,
    frequencyHz: midiToFrequency(midi),
    midi,
    clarity: 0.95,
    rms: 0.08
  };
}

function sineWave(frequencyHz: number, sampleRate: number, durationMs: number) {
  const length = Math.round((durationMs / 1000) * sampleRate);
  const samples = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    samples[index] = Math.sin((index / sampleRate) * frequencyHz * Math.PI * 2) * 0.3;
  }
  return samples;
}
