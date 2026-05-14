import { BasicPitch } from "@spotify/basic-pitch";
import * as tf from "@tensorflow/tfjs";
import basicPitchModelJson from "@spotify/basic-pitch/model/model.json";
import basicPitchWeightsUrl from "@spotify/basic-pitch/model/group1-shard1of1.bin?url";
import { stereoToMono } from "./audioData";
import { decodeBasicPitchOutputToReference } from "./basicPitchPostProcessing";
import type { SongReference, SongStereoBuffer, SongTranscriptionOptions } from "./types";

const BASIC_PITCH_SAMPLE_RATE = 22050;

let modelPromise: Promise<tf.GraphModel> | null = null;

export async function transcribeWithBasicPitch(
  vocals: SongStereoBuffer,
  options: SongTranscriptionOptions
): Promise<SongReference> {
  options.onStatus?.("Preparing vocal stem for note transcription");
  options.onProgress?.({ progress: 0.02 });
  const mono = await resampleToBasicPitchInput(vocals);
  options.onStatus?.("Loading Basic Pitch note model");
  const basicPitch = new BasicPitch(loadBasicPitchModel());

  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];

  await basicPitch.evaluateModel(
    mono,
    (nextFrames, nextOnsets, nextContours) => {
      frames.push(...nextFrames);
      onsets.push(...nextOnsets);
      contours.push(...nextContours);
    },
    (progress) => {
      options.onStatus?.("Transcribing vocal notes");
      options.onProgress?.({ progress: 0.05 + progress * 0.9 });
    }
  );

  options.onProgress?.({ progress: 1 });
  return decodeBasicPitchOutputToReference(
    { frames, onsets, contours },
    {
      durationMs: vocals.durationMs,
      detail: options.detail,
      lowestMidi: options.range.lowestMidi,
      highestMidi: options.range.highestMidi
    }
  );
}

async function loadBasicPitchModel() {
  modelPromise ??= loadBasicPitchGraphModel();
  return modelPromise;
}

async function loadBasicPitchGraphModel() {
  const weightData = await fetch(basicPitchWeightsUrl).then((response) => {
    if (!response.ok) {
      throw new Error("Could not load the Basic Pitch model weights.");
    }

    return response.arrayBuffer();
  });
  const modelJson = basicPitchModelJson as BasicPitchModelJson;
  const modelArtifacts = {
    modelTopology: modelJson.modelTopology,
    weightSpecs: modelJson.weightsManifest.flatMap((group) => group.weights),
    weightData
  } satisfies tf.io.ModelArtifacts;

  return tf.loadGraphModel(tf.io.fromMemory(modelArtifacts));
}

async function resampleToBasicPitchInput(vocals: SongStereoBuffer) {
  const mono = new Float32Array(stereoToMono(vocals));
  if (vocals.sampleRate === BASIC_PITCH_SAMPLE_RATE) {
    return mono;
  }

  if (typeof OfflineAudioContext === "undefined") {
    throw new Error("This browser cannot resample audio for vocal note transcription.");
  }

  const frameCount = Math.max(1, Math.ceil((mono.length * BASIC_PITCH_SAMPLE_RATE) / vocals.sampleRate));
  const offlineContext = new OfflineAudioContext(1, frameCount, BASIC_PITCH_SAMPLE_RATE);
  const inputBuffer = offlineContext.createBuffer(1, mono.length, vocals.sampleRate);
  inputBuffer.copyToChannel(mono, 0);

  const source = offlineContext.createBufferSource();
  source.buffer = inputBuffer;
  source.connect(offlineContext.destination);
  source.start(0);

  const rendered = await offlineContext.startRendering();
  return new Float32Array(rendered.getChannelData(0));
}

type BasicPitchModelJson = {
  modelTopology: object;
  weightsManifest: Array<{
    weights: tf.io.WeightsManifestEntry[];
  }>;
};
