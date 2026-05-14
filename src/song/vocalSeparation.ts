import { createStereoBuffer, mixStemsForAccompaniment } from "./audioData";
import { fetchModelWithCache } from "./modelCache";
import type {
  SongSeparationCallbacks,
  SongSeparationResult,
  SongStemMap,
  SongStereoBuffer,
  SongVocalSeparator
} from "./types";

type OnnxRuntimeWebGpu = typeof import("onnxruntime-web/webgpu");
type DemucsWebModule = typeof import("demucs-web");

const DEFAULT_MODEL_URL = "https://huggingface.co/timcsy/demucs-web-onnx/resolve/main/htdemucs_embedded.onnx";

export class DemucsWebVocalSeparator implements SongVocalSeparator {
  constructor(private readonly modelUrl = getConfiguredModelUrl()) {}

  async separate(
    audio: SongStereoBuffer,
    callbacks: SongSeparationCallbacks = {}
  ): Promise<SongSeparationResult> {
    callbacks.onStatus?.("Loading vocal isolation engine");
    const [{ DemucsProcessor }, ort] = await Promise.all([
      import("demucs-web"),
      import("onnxruntime-web/webgpu")
    ] satisfies [Promise<DemucsWebModule>, Promise<OnnxRuntimeWebGpu>]);

    configureOnnxRuntime(ort);
    const modelBuffer = await fetchModelWithCache(this.modelUrl, (progress) => {
      callbacks.onModelDownloadProgress?.({
        progress: progress.totalBytes ? progress.loadedBytes / progress.totalBytes : 0,
        currentSegment: progress.loadedBytes,
        totalSegments: progress.totalBytes
      });
    });

    callbacks.onStatus?.("Preparing WebGPU model");
    const processor = new DemucsProcessor({
      ort,
      sessionOptions: {
        executionProviders: ["webgpu"],
        graphOptimizationLevel: "basic"
      },
      onProgress: (progress) => callbacks.onSeparationProgress?.(progress),
      onLog: (_phase, message) => callbacks.onStatus?.(message)
    });

    await processor.loadModel(modelBuffer);
    callbacks.onStatus?.("Separating vocals");
    const result = await processor.separate(audio.left, audio.right);
    const stems: SongStemMap = {
      drums: toSongBuffer(result.drums, audio.sampleRate),
      bass: toSongBuffer(result.bass, audio.sampleRate),
      other: toSongBuffer(result.other, audio.sampleRate),
      vocals: toSongBuffer(result.vocals, audio.sampleRate)
    };

    return {
      vocals: stems.vocals,
      accompaniment: mixStemsForAccompaniment(stems),
      stems
    };
  }
}

export function getConfiguredModelUrl() {
  return import.meta.env.VITE_DEMUCS_MODEL_URL || DEFAULT_MODEL_URL;
}

function configureOnnxRuntime(ort: OnnxRuntimeWebGpu) {
  ort.env.wasm.numThreads = Math.max(1, Math.min(navigator.hardwareConcurrency || 4, 8));
}

function toSongBuffer(
  stem: { left: Float32Array; right: Float32Array },
  sampleRate: number
) {
  return createStereoBuffer(stem.left, stem.right, sampleRate);
}
