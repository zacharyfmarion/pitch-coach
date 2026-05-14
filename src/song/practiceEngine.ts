import { createAudioBufferFromStereo } from "./audioData";
import type { SongPracticeConfig, SongPracticeEngine } from "./types";

const WORKLET_URL = new URL("../audio/audio-input-processor.js", import.meta.url);
const FRAME_SIZE = 4096;
const HOP_SIZE = 1024;

type AudioFrameMessage = {
  type: "audio-frame";
  samples: Float32Array;
  timeMs: number;
};

export class BrowserSongPracticeEngine implements SongPracticeEngine {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private sink: GainNode | null = null;
  private accompanimentSource: AudioBufferSourceNode | null = null;
  private vocalSource: AudioBufferSourceNode | null = null;
  private vocalGain: GainNode | null = null;
  private playbackTimer: number | null = null;
  private running = false;
  private playbackStartMs = 0;
  private endedCallback: (() => void) | null = null;

  async start(config: SongPracticeConfig) {
    await this.stop();
    if (!BrowserSongPracticeEngine.isSupported()) {
      throw new Error("This browser does not support song practice audio capture.");
    }

    this.context = new AudioContext({ latencyHint: "interactive" });
    await this.context.audioWorklet.addModule(WORKLET_URL);
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    this.source = this.context.createMediaStreamSource(this.stream);
    this.worklet = new AudioWorkletNode(this.context, "pitch-coach-input", {
      processorOptions: {
        frameSize: FRAME_SIZE,
        hopSize: HOP_SIZE
      }
    });
    this.sink = this.context.createGain();
    this.sink.gain.value = 0;

    const accompanimentGain = this.context.createGain();
    accompanimentGain.gain.value = 0.95;
    this.vocalGain = this.context.createGain();
    this.vocalGain.gain.value = config.vocalGuideGain;

    this.accompanimentSource = this.context.createBufferSource();
    this.accompanimentSource.buffer = createAudioBufferFromStereo(this.context, config.accompaniment);
    this.vocalSource = this.context.createBufferSource();
    this.vocalSource.buffer = createAudioBufferFromStereo(this.context, config.vocals);

    this.source.connect(this.worklet);
    this.worklet.connect(this.sink);
    this.sink.connect(this.context.destination);
    this.accompanimentSource.connect(accompanimentGain).connect(this.context.destination);
    this.vocalSource.connect(this.vocalGain).connect(this.context.destination);

    this.playbackStartMs = (this.context.currentTime + 0.1) * 1000;
    this.endedCallback = config.onEnded;
    this.worklet.port.onmessage = (event: MessageEvent<AudioFrameMessage>) => {
      if (!this.running || event.data.type !== "audio-frame") {
        return;
      }

      const timeMs = event.data.timeMs - this.playbackStartMs;
      if (timeMs < -80) {
        return;
      }

      config.onPitchFrame(
        config.detector.detectPitch(
          event.data.samples,
          this.context!.sampleRate,
          Math.max(0, timeMs),
          config.bounds
        )
      );
    };

    this.accompanimentSource.onended = () => {
      if (!this.running) {
        return;
      }

      config.onPlaybackTime?.(config.accompaniment.durationMs);
      const onEnded = this.endedCallback;
      void this.stop().then(() => onEnded?.());
    };

    this.running = true;
    const startAt = this.playbackStartMs / 1000;
    config.onPlaybackTime?.(0);
    this.playbackTimer = window.setInterval(() => {
      if (!this.running || !this.context) {
        return;
      }

      const timeMs = Math.min(
        Math.max(0, this.context.currentTime * 1000 - this.playbackStartMs),
        config.accompaniment.durationMs
      );
      config.onPlaybackTime?.(timeMs);
    }, 50);
    this.accompanimentSource.start(startAt);
    this.vocalSource.start(startAt);
  }

  async stop() {
    const wasRunning = this.running;
    this.running = false;
    this.endedCallback = null;
    if (this.playbackTimer !== null) {
      window.clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }

    if (wasRunning) {
      try {
        this.accompanimentSource?.stop();
      } catch {
        // Already stopped.
      }
      try {
        this.vocalSource?.stop();
      } catch {
        // Already stopped.
      }
    }

    this.worklet?.port.close();
    this.source?.disconnect();
    this.worklet?.disconnect();
    this.sink?.disconnect();
    this.accompanimentSource?.disconnect();
    this.vocalSource?.disconnect();
    this.vocalGain?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());

    if (this.context && this.context.state !== "closed") {
      await this.context.close();
    }

    this.context = null;
    this.stream = null;
    this.source = null;
    this.worklet = null;
    this.sink = null;
    this.accompanimentSource = null;
    this.vocalSource = null;
    this.vocalGain = null;
    this.playbackStartMs = 0;
  }

  setVocalGuideGain(gain: number) {
    if (this.vocalGain) {
      this.vocalGain.gain.value = gain;
    }
  }

  isRunning() {
    return this.running;
  }

  static isSupported() {
    return Boolean(
      typeof window !== "undefined" &&
        window.AudioContext &&
        "AudioWorkletNode" in window &&
        navigator.mediaDevices?.getUserMedia
    );
  }
}
