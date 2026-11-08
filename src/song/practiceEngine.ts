import { createAudioBufferFromStereo, createStereoBuffer } from "./audioData";
import { preparePlayAndRecordAudioSession, resumeAudioContext } from "../audio/audioSession";
import { createAudioInputConstraints } from "../audio/inputConstraints";
import { SPEAKER_PITCH_OPTIONS, SPEAKER_SAMPLE_RATE } from "../audio/speakerSettings";
import { createCalibrationProbe, type CalibrationQuality } from "../audio/calibratedCancellation";
import { speakerMixGain } from "../audio/speakerHeadroom";
import { StreamingPitch } from "../audio/streamingPitch";
import { PitchyPitchDetectorAdapter } from "../audio/pitchyDetector";
import { pitchRejection, RAW_DIAGNOSTIC_THRESHOLDS } from "../audio/inputDiagnostics";
import type { SongPracticeConfig, SongPracticeEngine } from "./types";

const WORKLET_URL = new URL("../audio/speaker-input-processor.js", import.meta.url);

type Session = {
  context: AudioContext;
  stream?: MediaStream;
  nodes: AudioNode[];
  sources: AudioBufferSourceNode[];
  worklet?: AudioWorkletNode;
  worker?: Worker;
  channel?: MessageChannel;
  rejectInitialization?: (error: Error) => void;
  vocalGain?: GainNode;
  timer?: number;
  endTimer?: number;
  startMs: number;
  ignoreUntilMs: number;
  running: boolean;
  paused: boolean;
};

type AudioMessage = {
  type: "audio" | "processed" | "ready" | "error" | "calibrated";
  microphone?: Float32Array;
  samples?: Float32Array;
  startSample: number;
  message?: string;
  processingMs?: number;
  quality?: CalibrationQuality;
};

export class BrowserSongPracticeEngine implements SongPracticeEngine {
  private session: Session | null = null;
  private generation = 0;

  async start(config: SongPracticeConfig) {
    preparePlayAndRecordAudioSession();
    if (this.session) await this.stop();
    if (!BrowserSongPracticeEngine.isSupported()) throw new Error("This browser does not support song practice audio capture.");
    const generation = ++this.generation;
    const mode = config.inputMode ?? "headphones";
    const context = new AudioContext({ latencyHint: "interactive", ...(mode === "aec3" ? { sampleRate: SPEAKER_SAMPLE_RATE } : {}) });
    const session: Session = { context, nodes: [], sources: [], startMs: 0, ignoreUntilMs: 0, running: false, paused: false };
    this.session = session;
    const current = () => this.session === session && generation === this.generation;
    const fail = (message: string) => {
      if (!current()) return;
      void this.stop();
      config.onError?.(message);
    };
    try {
      await resumeAudioContext(context);
      if (!current()) return;
      if (mode === "aec3" && context.sampleRate !== SPEAKER_SAMPLE_RATE) throw new Error("Local speaker cancellation requires 48 kHz audio. Try browser cancellation or headphones.");
      await context.audioWorklet.addModule(WORKLET_URL);
      if (!current()) return;
      if (mode === "aec3") {
        config.onInputStatus?.("Loading local speaker cancellation…");
        session.worker = new Worker(new URL("../audio/speaker-worker.ts", import.meta.url), { type: "module" });
        session.channel = new MessageChannel();
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error("Speaker cancellation took too long to load. Try again or use headphones.")), 15000);
          session.rejectInitialization = (error) => { window.clearTimeout(timeout); reject(error); };
          session.worker!.onerror = () => session.rejectInitialization?.(new Error("Unable to load local speaker cancellation."));
          session.worker!.onmessage = (event: MessageEvent<AudioMessage>) => {
            if (event.data.type === "ready") {
              window.clearTimeout(timeout);
              session.rejectInitialization = undefined;
              resolve();
            } else if (event.data.type === "error") session.rejectInitialization?.(new Error(event.data.message));
          };
          session.worker!.postMessage({ type: "init", port: session.channel!.port1, diagnostics: Boolean(config.onInputDiagnostic) }, [session.channel!.port1]);
        });
        if (!current()) return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
        ...createAudioInputConstraints(config.deviceId), echoCancellation: mode === "browser"
      } });
      if (!current()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      session.stream = stream;
      const track = stream.getAudioTracks()[0];
      const settings = track.getSettings();
      if (mode === "browser" && settings.echoCancellation === false) throw new Error("This input does not support browser cancellation. Select local cancellation or headphones.");
      if (mode === "aec3" && settings.echoCancellation) throw new Error("The microphone did not disable browser cancellation. Use Browser cancellation to avoid processing twice.");
      track.addEventListener("ended", () => fail("Microphone disconnected. Reconnect it and start practice again."));
      const microphone = context.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(context, "pitch-coach-speaker-input", {
        numberOfInputs: 2, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2,
        channelCountMode: "explicit", processorOptions: { useWorker: mode === "aec3" }
      });
      session.worklet = worklet;
      const sink = context.createGain(); sink.gain.value = 0;
      const playback = context.createGain();
      const songMix = context.createGain();
      if (mode === "aec3") songMix.gain.value = speakerMixGain(config.accompaniment, config.vocals);
      const accompanimentGain = context.createGain(); accompanimentGain.gain.value = 0.95;
      const vocalGain = context.createGain(); vocalGain.gain.value = config.vocalGuideGain;
      session.vocalGain = vocalGain;
      session.nodes.push(microphone, worklet, sink, playback, songMix, accompanimentGain, vocalGain);
      microphone.connect(worklet, 0, 0);
      playback.connect(context.destination);
      playback.connect(worklet, 0, 1);
      worklet.connect(sink).connect(context.destination);
      accompanimentGain.connect(songMix);
      vocalGain.connect(songMix);
      songMix.connect(playback);
      const accompaniment = context.createBufferSource();
      accompaniment.buffer = createAudioBufferFromStereo(context, config.accompaniment);
      accompaniment.connect(accompanimentGain);
      const vocals = context.createBufferSource();
      vocals.buffer = createAudioBufferFromStereo(context, config.vocals);
      vocals.connect(vocalGain);
      session.sources.push(accompaniment, vocals);
      session.startMs = Infinity;
      // These are browser-reported estimates, not measured acoustic latency.
      const inputLatency = (settings as MediaTrackSettings & { latency?: number }).latency ?? 0;
      const deviceDelayMs = (inputLatency + context.baseLatency + (context.outputLatency ?? 0)) * 1000;
      const pitch = new StreamingPitch(config.detector, config.bounds, context.sampleRate);
      const rawPitch = mode === "aec3" && config.onInputDiagnostic
        ? new StreamingPitch(new PitchyPitchDetectorAdapter(RAW_DIAGNOSTIC_THRESHOLDS), config.bounds, context.sampleRate)
        : null;
      const reportCalibration = (quality: CalibrationQuality) => config.onInputDiagnosticSession?.({
        mode: "calibrated", calibration: quality, sampleRate: context.sampleRate, inputLatencyMs: inputLatency * 1000,
        outputLatencyMs: (context.outputLatency ?? 0) * 1000, baseLatencyMs: context.baseLatency * 1000,
        algorithmicDelayMs: 0,
        echoCancellation: settings.echoCancellation, noiseSuppression: settings.noiseSuppression,
        autoGainControl: settings.autoGainControl, bounds: config.bounds, thresholds: SPEAKER_PITCH_OPTIONS, rawThresholds: RAW_DIAGNOSTIC_THRESHOLDS
      });
      let receiveCalibration: ((quality: CalibrationQuality) => void) | undefined;
      const receive = (event: MessageEvent<AudioMessage>) => {
        if (!current()) return;
        if (event.data.type === "error") { fail(event.data.message ?? "Speaker processing failed."); return; }
        if (event.data.type === "calibrated" && event.data.quality) { receiveCalibration?.(event.data.quality); return; }
        // Drain blocks captured just before suspend so resuming has no sample gap.
        if (!session.running) return;
        const { startSample } = event.data;
        const samples = event.data.samples ?? event.data.microphone;
        if (!samples) return;
        if ((startSample + samples.length) / context.sampleRate * 1000 < session.startMs - 100) return;
        const queueLagMs = Math.max(0, (context.currentTime - (startSample + samples.length) / context.sampleRate) * 1000);
        if (queueLagMs > 500) {
          fail("Audio processing fell behind. Close busy tabs or try headphones."); return;
        }
        const rawFrames = rawPitch && event.data.microphone ? rawPitch.push(event.data.microphone, startSample) : [];
        for (const [index, frame] of pitch.push(samples, startSample).entries()) {
          const timeMs = frame.timeMs - session.startMs - deviceDelayMs;
          if (timeMs >= 0 && timeMs <= config.accompaniment.durationMs && frame.timeMs >= session.ignoreUntilMs) {
            config.onPitchFrame({ ...frame, timeMs });
            const raw = rawFrames[index];
            if (raw) config.onInputDiagnostic?.({
              raw: { ...raw, timeMs: raw.timeMs - session.startMs - deviceDelayMs },
              processed: { ...frame, timeMs }, rejection: pitchRejection(frame, SPEAKER_PITCH_OPTIONS),
              guideGain: vocalGain.gain.value, processingMs: event.data.processingMs ?? 0, queueLagMs
            });
          }
        }
      };
      worklet.port.onmessage = receive;
      worklet.onprocessorerror = () => fail("Audio capture stopped unexpectedly. Start practice again.");
      if (session.worker && session.channel) {
        session.worker.onmessage = receive;
        session.worker.onerror = () => fail("Speaker processing stopped unexpectedly. Try headphones or browser cancellation.");
        worklet.port.postMessage({ type: "connect", port: session.channel.port2 }, [session.channel.port2]);
      }
      if (mode === "aec3") {
        const probe = createCalibrationProbe();
        const calibration = context.createBufferSource();
        calibration.buffer = createAudioBufferFromStereo(context, createStereoBuffer(probe.left, probe.right, context.sampleRate));
        calibration.connect(playback);
        session.sources.push(calibration);
        const launchTime = Math.round((context.currentTime + 0.15) * context.sampleRate) / context.sampleRate;
        config.onInputStatus?.("Stay quiet for the four-second speaker check. Sing when the song starts.");
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error("Speaker check timed out. Try again or use headphones.")), 15000);
          session.rejectInitialization = (error) => { window.clearTimeout(timeout); reject(error); };
          receiveCalibration = (quality) => {
            window.clearTimeout(timeout);
            session.rejectInitialization = undefined;
            reportCalibration(quality);
            if (quality.accepted) resolve();
            else reject(new Error("Speaker check could not isolate playback reliably. Stay quiet, check speaker and microphone levels, and retry. If it keeps failing, use headphones."));
          };
          session.worker!.postMessage({ type: "calibrate", startSample: Math.round(launchTime * context.sampleRate) });
          calibration.start(launchTime);
        });
        if (!current()) return;
        // Flush the probe's acoustic tail and the worker queue before scoring.
        session.startMs = (context.currentTime + 0.5) * 1000;
      } else {
        session.startMs = (context.currentTime + 0.15) * 1000;
      }
      let statusShown = false;
      worklet.port.postMessage({ type: "active", startSample: Math.round(session.startMs / 1000 * context.sampleRate) });
      session.running = true;
      config.onPlaybackTime?.(0);
      session.timer = window.setInterval(() => {
        if (!current() || session.paused) return;
        const timeMs = Math.max(0, context.currentTime * 1000 - session.startMs);
        if (!statusShown && context.currentTime * 1000 >= session.startMs) {
          config.onInputStatus?.(mode === "aec3" ? "Calibrated cancellation active. Sing with the guide." : mode === "browser" ? "Browser cancellation requested. Sing with the track." : "Headphone mode. Microphone processing is off.");
          statusShown = true;
        }
        config.onPlaybackTime?.(Math.min(timeMs, config.accompaniment.durationMs));
      }, 50);
      accompaniment.onended = () => {
        if (!current() || !session.running) return;
        session.endTimer = window.setTimeout(() => {
          if (!current()) return;
          config.onPlaybackTime?.(config.accompaniment.durationMs);
          void this.stop().then(config.onEnded);
        }, Math.max(150, deviceDelayMs + 100));
      };
      accompaniment.start(session.startMs / 1000);
      vocals.start(session.startMs / 1000);
    } catch (error) {
      if (!current()) return;
      await this.stop();
      throw error;
    }
  }

  async pause() {
    const session = this.session;
    if (!session?.running || session.paused) return;
    session.paused = true;
    try { await session.context.suspend(); }
    catch (error) { session.paused = false; throw error; }
  }

  async resume() {
    const session = this.session;
    if (!session?.running || !session.paused) return;
    preparePlayAndRecordAudioSession();
    // Physical room echoes decay while the AudioContext clock is suspended.
    // Let the 341 ms filter history and pitch window refill before scoring.
    session.ignoreUntilMs = session.context.currentTime * 1000 + (session.worker ? 450 : 0);
    await resumeAudioContext(session.context);
    session.paused = false;
  }

  async stop() {
    this.generation += 1;
    const session = this.session;
    this.session = null;
    if (!session) return;
    session.running = false;
    window.clearInterval(session.timer);
    window.clearTimeout(session.endTimer);
    session.rejectInitialization?.(new Error("Practice cancelled."));
    session.worker?.terminate();
    session.channel?.port1.close();
    session.channel?.port2.close();
    session.worklet?.port.close();
    for (const source of session.sources) {
      source.onended = null;
      try { source.stop(); } catch { /* Not started or already stopped. */ }
      source.disconnect();
    }
    session.nodes.forEach((node) => node.disconnect());
    session.stream?.getTracks().forEach((track) => track.stop());
    if (session.context.state !== "closed") await session.context.close();
  }

  setVocalGuideGain(gain: number) {
    if (this.session?.vocalGain) this.session.vocalGain.gain.value = gain;
  }
  isRunning() { return this.session?.running ?? false; }
  isPaused() { return this.session?.paused ?? false; }
  static isSupported() {
    return Boolean(typeof window !== "undefined" && window.AudioContext && "AudioWorkletNode" in window && navigator.mediaDevices?.getUserMedia);
  }
}
