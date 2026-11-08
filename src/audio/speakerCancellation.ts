import type WebRtcAec3 from "@ennuicastr/webrtcaec3.js";

export const SPEAKER_SAMPLE_RATE = 48000;
export const SPEAKER_BLOCK_SIZE = 480;
// Impulse peak delay measured for the pinned 0.3.0 WASM at 48 kHz. This is
// algorithmic delay only: device input/output latency is handled by the engine.
export const AEC_DELAY_SAMPLES = 430;
export const SPEAKER_PITCH_OPTIONS = { clarityThreshold: 0.66, rmsThreshold: 0.008 } as const;

let modulePromise: Promise<WebRtcAec3.WebRtcAec3> | undefined;

export function loadEchoCanceller() {
  if (!modulePromise) {
    // This upstream Emscripten bundle assigns its embedded WASM URI to a global.
    // Predeclare it so its CommonJS wrapper also works inside strict ES workers.
    Object.assign(globalThis, { WebRtcAec3Wasm: "" });
    modulePromise = import("@ennuicastr/webrtcaec3.js")
      .then(({ default: createModule }) => createModule())
      .catch((error: unknown) => {
        modulePromise = undefined;
        throw error;
      });
  }
  return modulePromise;
}

/** Same stateful 10 ms processor used by the benchmark and browser worker. */
export class SpeakerCancellation {
  private readonly aec: WebRtcAec3.AEC3;
  private readonly output = new Float32Array(SPEAKER_BLOCK_SIZE);
  private disposed = false;

  constructor(module: WebRtcAec3.WebRtcAec3) {
    this.aec = new module.AEC3(SPEAKER_SAMPLE_RATE, 2, 1);
  }

  process(microphone: Float32Array, left: Float32Array, right: Float32Array): Float32Array {
    if (this.disposed) throw new Error("Echo canceller has been disposed.");
    if ([microphone, left, right].some((channel) => channel.length !== SPEAKER_BLOCK_SIZE)) {
      throw new Error("Echo cancellation requires synchronized 480-sample blocks at 48 kHz.");
    }
    this.aec.analyze([left, right]);
    this.aec.process([this.output], [microphone]);
    return this.output;
  }

  dispose() {
    if (!this.disposed) this.aec.free();
    this.disposed = true;
  }
}
