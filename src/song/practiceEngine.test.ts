import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserSongPracticeEngine } from "./practiceEngine";
import type { SongPracticeConfig } from "./types";

describe("song capture lifecycle", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("releases a microphone that arrives after the user stops", async () => {
    const context = installAudio();
    let grant: (stream: MediaStream) => void = () => {};
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((resolve) => { grant = resolve; }));
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const engine = new BrowserSongPracticeEngine();
    const starting = engine.start(config());
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    await engine.stop();
    const stop = vi.fn();
    grant({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await starting;
    expect(stop).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
    expect(engine.isRunning()).toBe(false);
  });

  it("closes the context after microphone permission fails", async () => {
    const context = installAudio();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new Error("Permission denied")) } });
    const engine = new BrowserSongPracticeEngine();
    await expect(engine.start(config())).rejects.toThrow("Permission denied");
    expect(context.close).toHaveBeenCalledOnce();
    expect(engine.isRunning()).toBe(false);
  });
});

function installAudio() {
  const context = {
    state: "running", sampleRate: 48000,
    audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) },
    close: vi.fn().mockResolvedValue(undefined)
  };
  vi.stubGlobal("AudioContext", class { constructor() { return context; } });
  vi.stubGlobal("AudioWorkletNode", class {});
  return context;
}

function config(): SongPracticeConfig {
  const buffer = { sampleRate: 48000, durationMs: 1000, left: new Float32Array(48000), right: new Float32Array(48000) };
  return { accompaniment: buffer, vocals: buffer, vocalGuideGain: 0,
    detector: { detectPitch: vi.fn() }, bounds: { minFrequencyHz: 65, maxFrequencyHz: 1100 }, onPitchFrame: vi.fn(), onEnded: vi.fn() };
}
