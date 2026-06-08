import type { SongStereoBuffer, SongStemMap } from "./types";

export const SONG_MODEL_SAMPLE_RATE = 44100;

type WindowWithAudioContext = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export async function decodeSongFile(file: File): Promise<SongStereoBuffer> {
  const AudioContextConstructor =
    window.AudioContext ?? (window as WindowWithAudioContext).webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error("This browser cannot decode audio files.");
  }

  const context = new AudioContextConstructor({ sampleRate: SONG_MODEL_SAMPLE_RATE });
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    return audioBufferToStereo(decoded);
  } finally {
    if (context.state !== "closed") {
      await context.close();
    }
  }
}

export function audioBufferToStereo(buffer: AudioBuffer): SongStereoBuffer {
  const left = new Float32Array(buffer.getChannelData(0));
  const right =
    buffer.numberOfChannels > 1
      ? new Float32Array(buffer.getChannelData(1))
      : new Float32Array(left);
  return createStereoBuffer(left, right, buffer.sampleRate);
}

export function createStereoBuffer(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number
): SongStereoBuffer {
  const length = Math.min(left.length, right.length);
  const leftCopy = left.length === length ? new Float32Array(left) : new Float32Array(left.subarray(0, length));
  const rightCopy =
    right.length === length ? new Float32Array(right) : new Float32Array(right.subarray(0, length));
  return {
    sampleRate,
    left: leftCopy,
    right: rightCopy,
    durationMs: samplesToMs(length, sampleRate)
  };
}

export function sliceStereoBuffer(
  buffer: SongStereoBuffer,
  startMs: number,
  endMs: number
): SongStereoBuffer {
  const startSample = clampSample(msToSamples(startMs, buffer.sampleRate), buffer.left.length);
  const endSample = clampSample(msToSamples(endMs, buffer.sampleRate), buffer.left.length);
  const safeEndSample = Math.max(startSample, endSample);
  return createStereoBuffer(
    buffer.left.subarray(startSample, safeEndSample),
    buffer.right.subarray(startSample, safeEndSample),
    buffer.sampleRate
  );
}

export function mixStemsForAccompaniment(stems: SongStemMap): SongStereoBuffer {
  return mixStereoBuffers([stems.drums, stems.bass, stems.other]);
}

export function mixStereoBuffers(buffers: SongStereoBuffer[]): SongStereoBuffer {
  const first = buffers[0];
  if (!first) {
    return createStereoBuffer(new Float32Array(), new Float32Array(), SONG_MODEL_SAMPLE_RATE);
  }

  const length = Math.max(...buffers.map((buffer) => buffer.left.length));
  const left = new Float32Array(length);
  const right = new Float32Array(length);

  buffers.forEach((buffer) => {
    const gain = 1 / Math.max(buffers.length, 1);
    for (let index = 0; index < length; index += 1) {
      left[index] += (buffer.left[index] ?? 0) * gain;
      right[index] += (buffer.right[index] ?? 0) * gain;
    }
  });

  return createStereoBuffer(left, right, first.sampleRate);
}

export function stereoToMono(buffer: SongStereoBuffer): Float32Array {
  const samples = new Float32Array(buffer.left.length);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = ((buffer.left[index] ?? 0) + (buffer.right[index] ?? 0)) / 2;
  }
  return samples;
}

export function createAudioBufferFromStereo(
  context: AudioContext,
  buffer: SongStereoBuffer
): AudioBuffer {
  const audioBuffer = context.createBuffer(2, buffer.left.length, buffer.sampleRate);
  const left = new Float32Array(buffer.left.length);
  left.set(buffer.left);
  const right = new Float32Array(buffer.right.length);
  right.set(buffer.right);
  audioBuffer.copyToChannel(left, 0);
  audioBuffer.copyToChannel(right, 1);
  return audioBuffer;
}

export function samplesToMs(samples: number, sampleRate: number) {
  return sampleRate > 0 ? (samples / sampleRate) * 1000 : 0;
}

export function msToSamples(timeMs: number, sampleRate: number) {
  return Math.round((Math.max(0, timeMs) / 1000) * sampleRate);
}

function clampSample(sample: number, length: number) {
  return Math.min(Math.max(0, sample), Math.max(0, length));
}
