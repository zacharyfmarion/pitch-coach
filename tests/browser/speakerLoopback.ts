import type { Page } from "@playwright/test";

/** A simulated acoustic path, not a mock of calibration or cancellation. */
export async function installSpeakerLoopback(page: Page, noiseRms = 0) {
  await page.addInitScript((noiseRms) => {
    const NativeAudioContext = window.AudioContext;
    const paths = new WeakMap<BaseAudioContext, { delay: DelayNode; mic: MediaStreamAudioDestinationNode }>();
    let latestStream: MediaStream;
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (...args: unknown[]) {
      const result = Reflect.apply(connect, this, args);
      const path = paths.get(this.context);
      if (args[0] === this.context.destination && path) Reflect.apply(connect, this, [path.delay]);
      return result;
    };
    window.AudioContext = class extends NativeAudioContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        const mic = this.createMediaStreamDestination();
        latestStream = mic.stream;
        const delay = this.createDelay(0.5);
        delay.delayTime.value = 0.065;
        delay.channelCount = 1; delay.channelCountMode = "explicit";
        const gain = this.createGain(); gain.gain.value = 0.65;
        delay.connect(gain).connect(mic);
        if (noiseRms > 0) {
          const noise = this.createBufferSource();
          const buffer = this.createBuffer(1, this.sampleRate, this.sampleRate);
          const samples = buffer.getChannelData(0);
          let seed = 491;
          for (let i = 0; i < samples.length; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            samples[i] = noiseRms * Math.sqrt(12) * (seed / 2 ** 32 - 0.5);
          }
          noise.buffer = buffer;
          noise.loop = true;
          noise.connect(mic);
          noise.start();
        }
        paths.set(this, { delay, mic });
        const track = mic.stream.getAudioTracks()[0];
        const settings = track.getSettings.bind(track);
        track.getSettings = () => ({ ...settings(), echoCancellation: false, noiseSuppression: false, autoGainControl: false });
      }
    };
    navigator.mediaDevices.getUserMedia = async () => latestStream;
  }, noiseRms);
}
