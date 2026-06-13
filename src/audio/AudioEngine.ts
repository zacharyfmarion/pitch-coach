import type { AudioCaptureConfig, AudioInputEngine } from "./types";
import { createAudioInputConstraints } from "./inputConstraints";

const DEFAULT_FRAME_SIZE = 4096;
const DEFAULT_HOP_SIZE = 1024;
const WORKLET_URL = new URL("./audio-input-processor.js", import.meta.url);

type AudioFrameMessage = {
  type: "audio-frame";
  samples: Float32Array;
  timeMs: number;
};

export class BrowserAudioEngine implements AudioInputEngine {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private sink: GainNode | null = null;
  private recorder: MediaRecorder | null = null;
  private recorderChunks: Blob[] = [];
  private recorderStartedAtMs = 0;
  private onAudioClip: AudioCaptureConfig["onAudioClip"] = undefined;
  private running = false;
  private originTimeMs: number | null = null;

  constructor(
    private readonly frameSize = DEFAULT_FRAME_SIZE,
    private readonly hopSize = DEFAULT_HOP_SIZE
  ) {}

  static isSupported() {
    return Boolean(
      typeof window !== "undefined" &&
        window.AudioContext &&
        "AudioWorkletNode" in window &&
        navigator.mediaDevices?.getUserMedia
    );
  }

  async startCapture(config: AudioCaptureConfig) {
    await this.stop();
    if (!BrowserAudioEngine.isSupported()) {
      throw new Error("This browser does not support microphone AudioWorklet capture.");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: createAudioInputConstraints(config.deviceId)
    });
    this.startRecorderIfRequested(config);

    this.context = new AudioContext({ latencyHint: "interactive" });
    await this.context.audioWorklet.addModule(WORKLET_URL);

    this.source = this.context.createMediaStreamSource(this.stream);
    this.worklet = new AudioWorkletNode(this.context, "pitch-coach-input", {
      processorOptions: {
        frameSize: this.frameSize,
        hopSize: this.hopSize
      }
    });
    this.sink = this.context.createGain();
    this.sink.gain.value = 0;
    this.originTimeMs = null;

    this.worklet.port.onmessage = (event: MessageEvent<AudioFrameMessage>) => {
      if (!this.running || event.data.type !== "audio-frame") {
        return;
      }

      if (this.originTimeMs === null) {
        this.originTimeMs = event.data.timeMs;
      }

      const frame = config.detector.detectPitch(
        event.data.samples,
        this.context!.sampleRate,
        event.data.timeMs - this.originTimeMs,
        config.bounds
      );
      config.onPitchFrame(frame);
    };

    this.source.connect(this.worklet);
    this.worklet.connect(this.sink);
    this.sink.connect(this.context.destination);
    this.running = true;
  }

  async stop() {
    this.running = false;
    this.originTimeMs = null;
    await this.stopRecorder();
    this.worklet?.port.close();
    this.source?.disconnect();
    this.worklet?.disconnect();
    this.sink?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());

    if (this.context && this.context.state !== "closed") {
      await this.context.close();
    }

    this.context = null;
    this.stream = null;
    this.source = null;
    this.worklet = null;
    this.sink = null;
    this.recorder = null;
    this.recorderChunks = [];
    this.onAudioClip = undefined;
  }

  isRunning() {
    return this.running;
  }

  private startRecorderIfRequested(config: AudioCaptureConfig) {
    this.recorder = null;
    this.recorderChunks = [];
    this.onAudioClip = config.onAudioClip;

    if (!config.captureAudioClip || !this.stream || typeof MediaRecorder === "undefined") {
      return;
    }

    try {
      const mimeType = selectRecorderMimeType();
      this.recorder = mimeType
        ? new MediaRecorder(this.stream, { mimeType })
        : new MediaRecorder(this.stream);
      this.recorderStartedAtMs = performance.now();
      this.recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recorderChunks.push(event.data);
        }
      };
      this.recorder.onstop = () => {
        if (this.recorderChunks.length === 0) {
          return;
        }

        const clipMimeType = this.recorder?.mimeType || mimeType || "audio/webm";
        this.onAudioClip?.({
          blob: new Blob(this.recorderChunks, { type: clipMimeType }),
          mimeType: clipMimeType,
          durationMs: Math.max(0, performance.now() - this.recorderStartedAtMs),
          createdAt: new Date().toISOString()
        });
      };
      this.recorder.start();
    } catch {
      this.recorder = null;
      this.recorderChunks = [];
    }
  }

  private async stopRecorder() {
    if (!this.recorder || this.recorder.state === "inactive") {
      return;
    }

    await new Promise<void>((resolve) => {
      const recorder = this.recorder!;
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });
  }
}

function selectRecorderMimeType() {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return options.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}
