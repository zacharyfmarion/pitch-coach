import { createAudioBufferFromStereo } from "./audioData";
import { createAudioInputConstraints } from "../audio/inputConstraints";
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
  private playbackTimeCallback: ((timeMs: number) => void) | null = null;
  private playbackDurationMs = 0;
  private running = false;
  private paused = false;
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
      audio: createAudioInputConstraints(config.deviceId)
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
      if (!this.running || this.paused || event.data.type !== "audio-frame") {
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
    this.paused = false;
    this.playbackDurationMs = config.accompaniment.durationMs;
    this.playbackTimeCallback = config.onPlaybackTime ?? null;
    const startAt = this.playbackStartMs / 1000;
    config.onPlaybackTime?.(0);
    this.startPlaybackTimer();
    this.accompanimentSource.start(startAt);
    this.vocalSource.start(startAt);
  }

  async pause() {
    if (!this.running || this.paused || !this.context) {
      return;
    }

    this.paused = true;
    this.clearPlaybackTimer();
    try {
      if (this.context.state === "running") {
        await this.context.suspend();
      }
    } catch (error) {
      this.paused = false;
      this.startPlaybackTimer();
      throw error;
    }
  }

  async resume() {
    if (!this.running || !this.paused || !this.context) {
      return;
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }
    this.paused = false;
    this.startPlaybackTimer();
  }

  async stop() {
    const wasRunning = this.running;
    this.running = false;
    this.paused = false;
    this.endedCallback = null;
    this.clearPlaybackTimer();

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
    this.playbackTimeCallback = null;
    this.playbackDurationMs = 0;
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

  isPaused() {
    return this.paused;
  }

  static isSupported() {
    return Boolean(
      typeof window !== "undefined" &&
        window.AudioContext &&
        "AudioWorkletNode" in window &&
        navigator.mediaDevices?.getUserMedia
    );
  }

  private clearPlaybackTimer() {
    if (this.playbackTimer !== null) {
      window.clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  private startPlaybackTimer() {
    this.clearPlaybackTimer();
    this.playbackTimer = window.setInterval(() => {
      if (!this.running || this.paused || !this.context) {
        return;
      }

      const timeMs = Math.min(
        Math.max(0, this.context.currentTime * 1000 - this.playbackStartMs),
        this.playbackDurationMs
      );
      this.playbackTimeCallback?.(timeMs);
    }, 50);
  }
}
