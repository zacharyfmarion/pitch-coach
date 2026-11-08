import type { Page } from "@playwright/test";

/** A simulated acoustic path, not a mock of calibration or cancellation. */
export async function installSpeakerLoopback(page: Page) {
  await page.addInitScript(() => {
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
        paths.set(this, { delay, mic });
        const track = mic.stream.getAudioTracks()[0];
        const settings = track.getSettings.bind(track);
        track.getSettings = () => ({ ...settings(), echoCancellation: false, noiseSuppression: false, autoGainControl: false });
      }
    };
    navigator.mediaDevices.getUserMedia = async () => latestStream;
  });
}
