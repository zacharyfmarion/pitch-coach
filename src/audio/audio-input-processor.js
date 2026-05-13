class PitchCoachInputProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const processorOptions = options.processorOptions || {};
    this.frameSize = processorOptions.frameSize || 4096;
    this.hopSize = processorOptions.hopSize || 1024;
    this.buffer = new Float32Array(this.frameSize);
    this.writeIndex = 0;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) {
      return true;
    }

    for (let index = 0; index < input.length; index += 1) {
      this.buffer[this.writeIndex] = input[index];
      this.writeIndex += 1;

      if (this.writeIndex === this.frameSize) {
        const samples = this.buffer.slice();
        this.port.postMessage(
          {
            type: "audio-frame",
            samples,
            timeMs: currentTime * 1000
          },
          [samples.buffer]
        );
        this.buffer.copyWithin(0, this.hopSize);
        this.writeIndex = this.frameSize - this.hopSize;
      }
    }

    return true;
  }
}

registerProcessor("pitch-coach-input", PitchCoachInputProcessor);
