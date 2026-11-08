/* Capture the microphone and the actual post-gain stereo playback on one clock. */
class SpeakerInputProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.target = this.port;
    this.pending = 0;
    this.activeAt = Infinity;
    this.failed = false;
    this.microphone = new Float32Array(480);
    this.left = new Float32Array(480);
    this.right = new Float32Array(480);
    this.used = 0;
    this.startSample = 0;
    this.useWorker = Boolean(options.processorOptions?.useWorker);
    this.port.onmessage = (event) => {
      if (event.data.type === "active") { this.activeAt = event.data.startSample; return; }
      if (event.data.type === "connect") {
        this.target = event.data.port;
        this.target.onmessage = () => { this.pending = Math.max(0, this.pending - 1); };
        this.target.start();
      }
    };
  }

  process(inputs) {
    if (this.failed || (this.useWorker && this.target === this.port)) return true;
    const mic = inputs[0]?.[0];
    if (!mic) return true;
    const left = inputs[1]?.[0];
    const right = inputs[1]?.[1] ?? left;
    for (let i = 0; i < mic.length; i += 1) {
      if (this.used === 0) this.startSample = currentFrame + i;
      this.microphone[this.used] = mic[i];
      this.left[this.used] = left?.[i] ?? 0;
      this.right[this.used] = right?.[i] ?? 0;
      this.used += 1;
      if (this.used === 480) {
        if (this.useWorker && this.pending >= (currentFrame >= this.activeAt ? 20 : 200)) {
          this.failed = true;
          this.port.postMessage({ type: "error", message: "Speaker processing could not keep up. Try headphones or browser cancellation." });
          return true;
        }
        this.target.postMessage({ type: "audio", microphone: this.microphone, left: this.left, right: this.right, startSample: this.startSample },
          [this.microphone.buffer, this.left.buffer, this.right.buffer]);
        if (this.useWorker) this.pending += 1;
        this.microphone = new Float32Array(480);
        this.left = new Float32Array(480);
        this.right = new Float32Array(480);
        this.used = 0;
      }
    }
    return true;
  }
}

registerProcessor("pitch-coach-speaker-input", SpeakerInputProcessor);
