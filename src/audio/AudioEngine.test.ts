import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserAudioEngine } from "./AudioEngine";
import type { PitchDetectorAdapter } from "./types";

const originalAudioContext = globalThis.AudioContext;
const originalWindowAudioContext = window.AudioContext;
const originalAudioWorkletNode = globalThis.AudioWorkletNode;
const originalWindowAudioWorkletNode = window.AudioWorkletNode;
const originalMediaDevicesDescriptor = Object.getOwnPropertyDescriptor(
  globalThis.navigator,
  "mediaDevices"
);
const originalAudioSessionDescriptor = Object.getOwnPropertyDescriptor(
  globalThis.navigator,
  "audioSession"
);

describe("BrowserAudioEngine", () => {
  afterEach(() => {
    globalThis.AudioContext = originalAudioContext;
    window.AudioContext = originalWindowAudioContext;
    globalThis.AudioWorkletNode = originalAudioWorkletNode;
    window.AudioWorkletNode = originalWindowAudioWorkletNode;
    restoreNavigatorProperty("mediaDevices", originalMediaDevicesDescriptor);
    restoreNavigatorProperty("audioSession", originalAudioSessionDescriptor);
  });

  it("switches iOS AudioSession out of playback before requesting mic capture", async () => {
    const audioSession = { type: "playback" };
    const typesAtCapture: string[] = [];
    const stream = {
      getTracks: () => [{ stop: vi.fn() }]
    };
    const getUserMedia = vi.fn(async () => {
      typesAtCapture.push(audioSession.type);
      return stream;
    });

    installAudioEnvironment({
      audioSession,
      getUserMedia
    });

    const engine = new BrowserAudioEngine();
    await engine.startCapture({
      detector: createDetector(),
      bounds: { minFrequencyHz: 80, maxFrequencyHz: 1000 },
      onPitchFrame: vi.fn()
    });
    await engine.stop();

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(typesAtCapture).toEqual(["play-and-record"]);
  });
});

function installAudioEnvironment({
  audioSession,
  getUserMedia
}: {
  audioSession: { type: string };
  getUserMedia: ReturnType<typeof vi.fn>;
}) {
  class TestAudioContext {
    state: AudioContextState = "suspended";
    sampleRate = 44100;
    destination = {};
    audioWorklet = {
      addModule: vi.fn(() => Promise.resolve())
    };

    resume = vi.fn(async () => {
      this.state = "running";
    });

    close = vi.fn(async () => {
      this.state = "closed";
    });

    createMediaStreamSource = vi.fn(() => createConnectableNode());
    createGain = vi.fn(() => ({
      ...createConnectableNode(),
      gain: { value: 1 }
    }));
  }

  class TestAudioWorkletNode {
    port = {
      onmessage: null,
      close: vi.fn()
    };
    connect = vi.fn();
    disconnect = vi.fn();
  }

  globalThis.AudioContext = TestAudioContext as unknown as typeof AudioContext;
  window.AudioContext = TestAudioContext as unknown as typeof AudioContext;
  globalThis.AudioWorkletNode =
    TestAudioWorkletNode as unknown as typeof AudioWorkletNode;
  window.AudioWorkletNode = TestAudioWorkletNode as unknown as typeof AudioWorkletNode;

  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia
    }
  });
  Object.defineProperty(globalThis.navigator, "audioSession", {
    configurable: true,
    value: audioSession
  });
}

function createConnectableNode() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn()
  };
}

function createDetector(): PitchDetectorAdapter {
  return {
    detectPitch: vi.fn(() => ({
      timeMs: 0,
      frequencyHz: null,
      clarity: 0,
      rms: 0
    }))
  };
}

function restoreNavigatorProperty(
  property: "mediaDevices" | "audioSession",
  descriptor: PropertyDescriptor | undefined
) {
  if (descriptor) {
    Object.defineProperty(globalThis.navigator, property, descriptor);
  } else {
    delete (globalThis.navigator as Navigator & Record<typeof property, unknown>)[property];
  }
}
