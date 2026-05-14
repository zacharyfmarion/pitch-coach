import { describe, expect, it } from "vitest";
import type { PitchDetectorAdapter } from "../audio/types";
import { PitchyPitchDetectorAdapter } from "../audio/pitchyDetector";
import { midiToFrequency } from "../domain/music";
import { createStereoBuffer } from "./audioData";
import {
  extractReferenceNotes,
  extractReferencePitch,
  extractSongPhrases,
  smoothReferenceFrames
} from "./referencePitch";
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
    expect(reference.notes).toHaveLength(1);
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

  it("groups a sung contour into stable note segments instead of raw pitch spikes", () => {
    const frames: SongReferenceFrame[] = [
      referenceFrame(0, 60),
      referenceFrame(50, 60.08),
      referenceFrame(100, 59.95),
      silenceFrame(150),
      referenceFrame(200, 60.02),
      referenceFrame(250, 60.1),
      referenceFrame(300, 62),
      referenceFrame(350, 62.1),
      referenceFrame(400, 61.95)
    ];

    const smoothed = smoothReferenceFrames(frames);
    const notes = extractReferenceNotes(smoothed);

    expect(notes).toHaveLength(2);
    expect(notes[0].medianMidi).toBeCloseTo(60, 0);
    expect(notes[0].endMs - notes[0].startMs).toBeGreaterThan(200);
    expect(notes[1].medianMidi).toBeCloseTo(62, 0);
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

function silenceFrame(timeMs: number): SongReferenceFrame {
  return {
    timeMs,
    frequencyHz: null,
    midi: null,
    clarity: 0.1,
    rms: 0.001
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
