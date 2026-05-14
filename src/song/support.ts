import type { SongRuntimeSupport } from "./types";

type NavigatorWithGpu = Navigator & {
  gpu?: {
    requestAdapter: () => Promise<unknown>;
  };
};

type WindowWithAudioContext = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export async function detectSongRuntimeSupport(): Promise<SongRuntimeSupport> {
  const reasons: string[] = [];

  if (!window.isSecureContext) {
    reasons.push("Song mode requires HTTPS or localhost.");
  }

  if (globalThis.crossOriginIsolated !== true) {
    reasons.push("Song mode requires cross-origin isolation headers.");
  }

  const AudioContextConstructor =
    window.AudioContext ?? (window as WindowWithAudioContext).webkitAudioContext;
  if (!AudioContextConstructor) {
    reasons.push("This browser cannot decode local audio files.");
  }

  const gpu = (navigator as NavigatorWithGpu).gpu;
  if (!gpu) {
    reasons.push("Song mode requires WebGPU.");
  } else {
    try {
      const adapter = await gpu.requestAdapter();
      if (!adapter) {
        reasons.push("No compatible WebGPU adapter was found.");
      }
    } catch {
      reasons.push("WebGPU is not available in this browser session.");
    }
  }

  return {
    supported: reasons.length === 0,
    checking: false,
    reasons
  };
}

export function pendingSongRuntimeSupport(): SongRuntimeSupport {
  return {
    supported: false,
    checking: true,
    reasons: []
  };
}
