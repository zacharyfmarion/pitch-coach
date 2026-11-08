import { expect, test } from "@playwright/test";

test.use({
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] },
  permissions: ["microphone"]
});

test("speaker demo works without WebGPU, loads real WASM, pauses, stops, and changes mode", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const modelRequests: string[] = [];
  page.on("request", (request) => { if (/huggingface|\.onnx/.test(request.url())) modelRequests.push(request.url()); });
  await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }));
  await page.goto("/songs");
  await page.getByRole("button", { name: "Try speaker prototype" }).click();
  await expect(page.getByLabel("Song pitch timeline")).toBeVisible();
  const modes = page.getByRole("group", { name: "Microphone processing" });
  await expect(modes.getByRole("button", { name: "Speakers", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Start song practice" }).click();
  await expect(page.getByRole("status", { name: "Microphone status" })).toContainText("Local cancellation active", { timeout: 20000 });
  await expect(modes.getByRole("button", { name: "Headphones" })).toBeDisabled();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByRole("status", { name: "Microphone status" })).toHaveText("Microphone is off.");
  await modes.getByRole("button", { name: "Headphones" }).click();
  await page.getByRole("button", { name: "Start song practice" }).click();
  await expect(page.getByRole("status", { name: "Microphone status" })).toContainText("Headphone mode");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.screenshot({ path: "test-results/speaker-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(modes).toBeVisible();
  const layout = await page.evaluate(() => {
    const chart = document.querySelector(".mock-song-timeline-card")!.getBoundingClientRect();
    const transport = document.querySelector(".mock-song-transport")!.getBoundingClientRect();
    const controls = document.querySelector(".mock-song-side-panel")!.getBoundingClientRect();
    return { chartHeight: chart.height, chartBottom: chart.bottom, transportTop: transport.top, transportBottom: transport.bottom, controlsTop: controls.top };
  });
  expect(layout.chartHeight).toBeGreaterThanOrEqual(300);
  expect(layout.transportTop).toBeGreaterThanOrEqual(layout.chartBottom);
  expect(layout.controlsTop).toBeGreaterThanOrEqual(layout.transportBottom);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/speaker-mobile.png", fullPage: true });
  expect(errors).toEqual([]);
  expect(modelRequests).toEqual([]);
});

test("real AudioWorklet/Worker graph cancels known speaker leakage while preserving independent pitch", async ({ page }) => {
  test.setTimeout(30000);
  await page.goto("/songs");
  const result = await page.evaluate(async () => {
    // These Vite-served modules exercise exactly the production worker and DSP.
    const { createMixture } = await import("/benchmarks/speaker/fixtures.ts");
    const { StreamingPitch } = await import("/src/audio/streamingPitch.ts");
    const { PitchyPitchDetectorAdapter } = await import("/src/audio/pitchyDetector.ts");
    const { AEC_DELAY_SAMPLES, SPEAKER_PITCH_OPTIONS, loadEchoCanceller, SpeakerCancellation } = await import("/src/audio/speakerCancellation.ts");
    const context = new AudioContext({ sampleRate: 48000 });
    await context.resume();
    await context.audioWorklet.addModule("/src/audio/speaker-input-processor.js");
    const node = new AudioWorkletNode(context, "pitch-coach-speaker-input", {
      numberOfInputs: 2, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2, channelCountMode: "explicit", processorOptions: { useWorker: true }
    });
    const worker = new Worker("/src/audio/speaker-worker.ts", { type: "module" });
    const channel = new MessageChannel();
    await new Promise<void>((resolve, reject) => {
      worker.onerror = (event) => reject(new Error(event.message));
      worker.onmessage = (event) => event.data.type === "ready" ? resolve() : reject(new Error(event.data.message));
      worker.postMessage({ type: "init", port: channel.port1 }, [channel.port1]);
    });
    node.port.postMessage({ type: "connect", port: channel.port2 }, [channel.port2]);
    const vocal = new Float32Array(6 * 48000);
    for (let i = 48000; i < 5 * 48000; i += 1) vocal[i] = 0.1 * Math.sin(2 * Math.PI * 220 * i / 48000);
    const mixture = createMixture(vocal, { id: "browser", sirDb: 0, delayMs: 65 }, 73);
    // Compare to sequential processing of the identical mixture. The sustained
    // sine is intentionally difficult: cancellation helps but drops some notes.
    const offline = new SpeakerCancellation(await loadEchoCanceller());
    const offlinePitch = new StreamingPitch(new PitchyPitchDetectorAdapter(SPEAKER_PITCH_OPTIONS), { minFrequencyHz: 65, maxFrequencyHz: 1100 }, 48000, AEC_DELAY_SAMPLES);
    const offlineFrequencies: Array<number | null> = [];
    for (let i = 0; i < mixture.microphone.length; i += 480) {
      const samples = offline.process(mixture.microphone.subarray(i, i + 480), mixture.left.subarray(i, i + 480), mixture.right.subarray(i, i + 480));
      for (const frame of offlinePitch.push(samples, i)) if (frame.timeMs >= 4000 && frame.timeMs <= 6800) offlineFrequencies.push(frame.frequencyHz);
    }
    offline.dispose();
    const mic = context.createBuffer(1, mixture.microphone.length, 48000);
    mic.copyToChannel(mixture.microphone, 0);
    const render = context.createBuffer(2, mixture.left.length, 48000);
    render.copyToChannel(mixture.left, 0); render.copyToChannel(mixture.right, 1);
    const micSource = context.createBufferSource(); micSource.buffer = mic; micSource.connect(node, 0, 0);
    const referenceSource = context.createBufferSource(); referenceSource.buffer = render; referenceSource.connect(node, 0, 1);
    const sink = context.createGain(); sink.gain.value = 0; node.connect(sink).connect(context.destination);
    const startAt = context.currentTime + 0.1;
    const tracker = new StreamingPitch(new PitchyPitchDetectorAdapter(SPEAKER_PITCH_OPTIONS), { minFrequencyHz: 65, maxFrequencyHz: 1100 }, 48000, AEC_DELAY_SAMPLES);
    const frequencies: Array<number | null> = [];
    const failures: string[] = [];
    let blocks = 0;
    node.port.onmessage = (event) => failures.push(event.data.message);
    worker.onmessage = (event) => {
      if (event.data.type === "error") { failures.push(event.data.message); return; }
      blocks += 1;
      for (const frame of tracker.push(event.data.samples, event.data.startSample)) {
        const time = frame.timeMs / 1000 - startAt;
        if (time >= 4 && time <= 6.8) frequencies.push(frame.frequencyHz);
      }
    };
    micSource.start(startAt); referenceSource.start(startAt);
    await new Promise<void>((resolve) => { micSource.onended = () => setTimeout(resolve, 100); });
    worker.terminate(); node.disconnect(); await context.close();
    const recall = (values: Array<number | null>) => values.filter((f) => f !== null && Math.abs(1200 * Math.log2(f / 220)) < 50).length / values.length;
    return { blocks, failures, recall: recall(frequencies), offlineRecall: recall(offlineFrequencies) };
  });
  expect(result.failures).toEqual([]);
  expect(result.blocks).toBeGreaterThan(800);
  expect(result.recall).toBeGreaterThan(0.5);
  expect(Math.abs(result.recall - result.offlineRecall)).toBeLessThan(0.05);
});
