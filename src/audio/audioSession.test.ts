import { afterEach, describe, expect, it } from "vitest";
import {
  preparePlaybackAudioSession,
  preparePlayAndRecordAudioSession,
  setBrowserAudioSessionType
} from "./audioSession";

const originalAudioSessionDescriptor = Object.getOwnPropertyDescriptor(
  globalThis.navigator,
  "audioSession"
);

describe("browser audio session helpers", () => {
  afterEach(() => {
    if (originalAudioSessionDescriptor) {
      Object.defineProperty(globalThis.navigator, "audioSession", originalAudioSessionDescriptor);
    } else {
      delete (globalThis.navigator as Navigator & { audioSession?: unknown }).audioSession;
    }
  });

  it("does nothing on browsers without AudioSession support", () => {
    setAudioSession(undefined);

    expect(preparePlaybackAudioSession()).toBe(false);
  });

  it("requests playback audio for Web Audio guide tones", () => {
    const audioSession = { type: "auto" };
    setAudioSession(audioSession);

    expect(preparePlaybackAudioSession()).toBe(true);
    expect(audioSession.type).toBe("playback");
  });

  it("requests play-and-record audio for song practice", () => {
    const audioSession = { type: "auto" };
    setAudioSession(audioSession);

    expect(preparePlayAndRecordAudioSession()).toBe(true);
    expect(audioSession.type).toBe("play-and-record");
  });

  it("falls back when a preferred session type is rejected", () => {
    const audioSession = {
      currentType: "auto",
      get type() {
        return this.currentType;
      },
      set type(nextType: string) {
        if (nextType === "play-and-record") {
          throw new Error("unsupported");
        }
        this.currentType = nextType;
      }
    };
    setAudioSession(audioSession);

    expect(setBrowserAudioSessionType("play-and-record", "auto")).toBe(true);
    expect(audioSession.type).toBe("auto");
  });
});

function setAudioSession(audioSession: unknown) {
  Object.defineProperty(globalThis.navigator, "audioSession", {
    configurable: true,
    value: audioSession
  });
}
