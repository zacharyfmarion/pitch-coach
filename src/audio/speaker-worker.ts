import { loadEchoCanceller, SpeakerCancellation } from "./speakerCancellation";

let processor: SpeakerCancellation | undefined;
self.onmessage = async (event: MessageEvent<{ type: "init"; port: MessagePort }>) => {
  if (event.data.type !== "init") return;
  const port = event.data.port;
  try {
    processor = new SpeakerCancellation(await loadEchoCanceller());
    port.onmessage = (audio: MessageEvent<{ microphone: Float32Array; left: Float32Array; right: Float32Array; startSample: number }>) => {
      try {
        const start = performance.now();
        const { microphone, left, right, startSample } = audio.data;
        const samples = processor!.process(microphone, left, right).slice();
        self.postMessage({ type: "processed", samples, startSample, processingMs: performance.now() - start }, { transfer: [samples.buffer] });
        port.postMessage({ type: "ack" });
      } catch (error) {
        processor?.dispose();
        port.close();
        self.postMessage({ type: "error", message: error instanceof Error ? error.message : "Speaker processing failed." });
      }
    };
    port.start();
    self.postMessage({ type: "ready" });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : "Unable to load speaker processing." });
  }
};
