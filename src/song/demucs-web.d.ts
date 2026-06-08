declare module "demucs-web" {
  export type DemucsStem = {
    left: Float32Array;
    right: Float32Array;
  };

  export type DemucsSeparationResult = {
    drums: DemucsStem;
    bass: DemucsStem;
    other: DemucsStem;
    vocals: DemucsStem;
  };

  export type DemucsProcessorOptions = {
    ort: typeof import("onnxruntime-web/webgpu");
    sessionOptions?: Record<string, unknown>;
    onProgress?: (progress: {
      progress: number;
      currentSegment: number;
      totalSegments: number;
    }) => void;
    onLog?: (phase: string, message: string) => void;
    onDownloadProgress?: (loadedBytes: number, totalBytes: number) => void;
  };

  export class DemucsProcessor {
    constructor(options: DemucsProcessorOptions);
    loadModel(modelPathOrBuffer?: string | ArrayBuffer): Promise<unknown>;
    separate(leftChannel: Float32Array, rightChannel: Float32Array): Promise<DemucsSeparationResult>;
  }

  export const CONSTANTS: {
    DEFAULT_MODEL_URL: string;
    SAMPLE_RATE: number;
    TRACKS: readonly ["drums", "bass", "other", "vocals"];
  };
}
