import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { installSpeakerLoopback } from "./speakerLoopback";

test.use({
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] },
  permissions: ["microphone"]
});

test("speaker demo calibrates a real audio graph, exports diagnostics, pauses, stops, and changes mode", async ({ page }) => {
  await installSpeakerLoopback(page);
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
  await page.getByRole("switch", { name: "Debug microphone" }).click();
  await page.getByRole("button", { name: "Start song practice" }).click();
  await expect(page.getByRole("status", { name: "Microphone status" })).toContainText("Calibrated cancellation active", { timeout: 20000 });
  await expect(page.locator('[aria-label="Input measurements"] strong').nth(3)).not.toHaveText("0");
  await expect(page.getByRole("button", { name: "Download input report" })).toBeEnabled();
  await expect(page.getByRole("switch", { name: "Debug microphone" })).toBeDisabled();
  await expect(modes.getByRole("button", { name: "Headphones" })).toBeDisabled();
  await expect.poll(async () => Number(await page.locator('[aria-label="Input measurements"] strong').nth(3).textContent())).toBeGreaterThan(150);
  const beforePause = Number(await page.locator('[aria-label="Input measurements"] strong').nth(3).textContent());
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(async () => Number(await page.locator('[aria-label="Input measurements"] strong').nth(3).textContent())).toBeGreaterThan(beforePause + 30);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByRole("status", { name: "Microphone status" })).toHaveText("Microphone is off.");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download input report" }).click();
  const download = await downloaded;
  const reportPath = await download.path();
  expect(reportPath).not.toBeNull();
  const report = JSON.parse(await readFile(reportPath!, "utf8"));
  expect(report.kind).toBe("pitch-coach-input-diagnostics");
  expect(report.session).toMatchObject({ mode: "calibrated", calibration: { accepted: true }, sampleRate: 48000, echoCancellation: false, thresholds: { rmsThreshold: 0.008 } });
  expect(report.summary.receivedFrames).toBeGreaterThan(0);
  expect(report.frames).toHaveLength(report.summary.receivedFrames);
  expect(report.frames.every((frame: { processed: { frequencyHz: number | null } }) => frame.processed.frequencyHz === null)).toBe(true);
  expect(report.frames[0].raw.timeMs).toBeCloseTo(report.frames[0].processed.timeMs, 3);
  expect(report.frames.every((frame: { raw: { rms: number }; processingMs: number }) => Number.isFinite(frame.raw.rms) && frame.processingMs >= 0)).toBe(true);
  expect(JSON.stringify(report)).not.toMatch(/microphone":\[|samples|deviceId|groupId/);
  await page.screenshot({ path: "test-results/input-debug-desktop.png", fullPage: true });
  await modes.getByRole("button", { name: "Headphones" }).click();
  await page.getByRole("button", { name: "Start song practice" }).click();
  await expect(page.getByRole("status", { name: "Microphone status" })).toContainText("Headphone mode");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await modes.getByRole("button", { name: "Speakers", exact: true }).click();
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

test("actual worker preserves a three-second unison hold and rejects guide-only onsets and sustain", async ({ page }) => {
  test.setTimeout(30000);
  await page.goto("/songs");
  const result = await page.evaluate(async () => {
    const { createCalibrationProbe } = await import("/src/audio/calibratedCancellation.ts");
    const { StreamingPitch } = await import("/src/audio/streamingPitch.ts");
    const { PitchyPitchDetectorAdapter } = await import("/src/audio/pitchyDetector.ts");
    const { SPEAKER_PITCH_OPTIONS } = await import("/src/audio/speakerCancellation.ts");
    const probe = createCalibrationProbe();
    const practiceStart = probe.left.length + 24000;
    const length = practiceStart + 5 * 48000;
    const left = new Float32Array(length), right = new Float32Array(length), microphone = new Float32Array(length);
    left.set(probe.left); right.set(probe.right);
    for (let i = practiceStart; i < length; i += 1) {
      left[i] = right[i] = 0.08 * Math.sin(2 * Math.PI * 220 * i / 48000);
    }
    for (let i = 0; i < length; i += 1) {
      microphone[i] = 0.4 * (left[i - 3120] ?? 0) + 0.25 * (right[i - 3120] ?? 0) + 0.1 * (left[i - 3361] ?? 0);
      if (i >= practiceStart + 48000 && i < practiceStart + 4 * 48000) microphone[i] += 0.07 * Math.sin(2 * Math.PI * 220 * i / 48000 + 1.1);
    }
    const context = new AudioContext({ sampleRate: 48000 });
    await context.resume();
    await context.audioWorklet.addModule("/src/audio/speaker-input-processor.js");
    const node = new AudioWorkletNode(context, "pitch-coach-speaker-input", { numberOfInputs: 2, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2, channelCountMode: "explicit", processorOptions: { useWorker: true } });
    const worker = new Worker("/src/audio/speaker-worker.ts", { type: "module" });
    const channel = new MessageChannel();
    await new Promise<void>((resolve, reject) => {
      worker.onerror = (event) => reject(new Error(event.message));
      worker.onmessage = () => resolve();
      worker.postMessage({ type: "init", port: channel.port1 }, [channel.port1]);
    });
    node.port.postMessage({ type: "connect", port: channel.port2 }, [channel.port2]);
    const micBuffer = context.createBuffer(1, length, 48000); micBuffer.copyToChannel(microphone, 0);
    const render = context.createBuffer(2, length, 48000); render.copyToChannel(left, 0); render.copyToChannel(right, 1);
    const mic = context.createBufferSource(); mic.buffer = micBuffer; mic.connect(node, 0, 0);
    const reference = context.createBufferSource(); reference.buffer = render; reference.connect(node, 0, 1);
    const sink = context.createGain(); sink.gain.value = 0; node.connect(sink).connect(context.destination);
    const startSample = Math.round((context.currentTime + 0.15) * 48000);
    worker.postMessage({ type: "calibrate", startSample });
    const tracker = new StreamingPitch(new PitchyPitchDetectorAdapter(SPEAKER_PITCH_OPTIONS), { minFrequencyHz: 65, maxFrequencyHz: 1100 }, 48000);
    const singing: Array<number | null> = [], silent: Array<number | null> = [];
    const failures: string[] = [];
    let accepted = false, rawBlocks = 0;
    node.port.onmessage = (event) => failures.push(event.data.message);
    worker.onmessage = (event) => {
      if (event.data.type === "calibrated") { accepted = event.data.quality.accepted; return; }
      if (event.data.type === "error") { failures.push(event.data.message); return; }
      if (event.data.microphone) rawBlocks += 1;
      for (const frame of tracker.push(event.data.samples, event.data.startSample)) {
        const t = frame.timeMs / 1000 - (startSample + practiceStart) / 48000;
        if (t >= 1.1 && t < 3.9) singing.push(frame.frequencyHz);
        if (t >= 0.05 && t < 0.9 || t >= 4.1 && t < 4.9) silent.push(frame.frequencyHz);
      }
    };
    mic.start(startSample / 48000); reference.start(startSample / 48000);
    await new Promise<void>((resolve) => { mic.onended = () => setTimeout(resolve, 100); });
    worker.terminate(); node.disconnect(); await context.close();
    return { accepted, failures, rawBlocks, singingFrames: singing.length, silentFrames: silent.length,
      recall: singing.filter((f) => f !== null && Math.abs(1200 * Math.log2(f / 220)) <= 50).length / singing.length,
      falseRate: silent.filter((f) => f !== null).length / silent.length };
  });
  expect(result.accepted).toBe(true);
  expect(result.failures).toEqual([]);
  expect(result.rawBlocks).toBe(0);
  expect(result.singingFrames).toBeGreaterThan(130);
  expect(result.silentFrames).toBeGreaterThan(75);
  expect(result.recall).toBeGreaterThanOrEqual(0.95);
  expect(result.falseRate).toBeLessThanOrEqual(0.01);
});

test("stopping calibration cancels it, and an uncorrelated microphone fails without scoring", async ({ page }) => {
  await page.goto("/songs");
  await page.getByRole("button", { name: "Try speaker prototype" }).click();
  await page.getByRole("switch", { name: "Debug microphone" }).click();
  await page.getByRole("button", { name: "Start song practice" }).click();
  await expect(page.getByRole("status", { name: "Microphone status" })).toContainText("four-second speaker check");
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.getByRole("button", { name: "Start song practice" }).click();
  await expect(page.getByRole("alert")).toContainText("could not isolate playback reliably", { timeout: 20000 });
  await expect(page.getByRole("button", { name: "Start song practice" })).toBeEnabled();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download input report" }).click();
  const report = JSON.parse(await readFile((await (await pending).path())!, "utf8"));
  expect(report.session.calibration.accepted).toBe(false);
  expect(report.frames).toEqual([]);
});
