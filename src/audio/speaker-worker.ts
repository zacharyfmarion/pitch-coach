import { CALIBRATION_SAMPLES, CalibratedCancellation } from "./calibratedCancellation";

type AudioBlock = { microphone: Float32Array; left: Float32Array; right: Float32Array; startSample: number };
let processor: CalibratedCancellation | undefined;
let calibration: { startSample: number; received: number; microphone: Float32Array; left: Float32Array; right: Float32Array } | undefined;
let port: MessagePort;
let diagnostics = false;

self.onmessage = (event: MessageEvent<{ type: "init" | "calibrate"; port: MessagePort; diagnostics?: boolean; startSample: number }>) => {
  if (event.data.type === "calibrate") {
    calibration = { startSample: event.data.startSample, received: 0, microphone: new Float32Array(CALIBRATION_SAMPLES), left: new Float32Array(CALIBRATION_SAMPLES), right: new Float32Array(CALIBRATION_SAMPLES) };
    return;
  }
  port = event.data.port;
  diagnostics = Boolean(event.data.diagnostics);
  port.onmessage = (audio: MessageEvent<AudioBlock>) => {
    // Acknowledge receipt before the one-time fit; scoring awaits validation.
    port.postMessage({ type: "ack" });
    try {
      const { microphone, left, right, startSample } = audio.data;
      if (calibration) {
        const from = Math.max(0, calibration.startSample - startSample);
        const to = Math.min(microphone.length, calibration.startSample + CALIBRATION_SAMPLES - startSample);
        if (to <= from) return;
        const at = startSample + from - calibration.startSample;
        if (at !== calibration.received) throw new Error("Speaker check lost audio frames. Try again or use headphones.");
        calibration.microphone.set(microphone.subarray(from, to), at);
        calibration.left.set(left.subarray(from, to), at);
        calibration.right.set(right.subarray(from, to), at);
        calibration.received += to - from;
        if (calibration.received === CALIBRATION_SAMPLES) {
          processor = new CalibratedCancellation(calibration.microphone, calibration.left, calibration.right);
          calibration = undefined;
          self.postMessage({ type: "calibrated", quality: processor.quality });
          if (!processor.quality.accepted) processor = undefined;
        }
        return;
      }
      if (!processor) return;
      const start = performance.now();
      const samples = processor.process(microphone, left, right).slice();
      const raw = diagnostics ? microphone : undefined;
      self.postMessage({ type: "processed", samples, microphone: raw, startSample, processingMs: performance.now() - start }, { transfer: raw ? [samples.buffer, raw.buffer] : [samples.buffer] });
    } catch (error) {
      processor = undefined;
      calibration = undefined;
      port.close();
      self.postMessage({ type: "error", message: error instanceof Error ? error.message : "Speaker processing failed." });
    }
  };
  port.start();
  self.postMessage({ type: "ready" });
};
