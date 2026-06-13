import { BrowserAudioInputDeviceService } from "./audioInputDevices";
import { BrowserAudioEngine } from "./AudioEngine";
import { PitchyPitchDetectorAdapter } from "./pitchyDetector";
import { TonePromptPlayer } from "./PromptPlayer";
import type {
  AudioInputDeviceService,
  AudioInputEngine,
  PitchDetectorAdapter,
  PromptPlayer
} from "./types";

export type PitchCoachServices = {
  audioEngine: AudioInputEngine;
  detector: PitchDetectorAdapter;
  promptPlayer: PromptPlayer;
  audioInputs?: AudioInputDeviceService;
};

export function createPitchCoachServices(): PitchCoachServices {
  return {
    audioEngine: new BrowserAudioEngine(),
    detector: new PitchyPitchDetectorAdapter(),
    promptPlayer: new TonePromptPlayer(),
    audioInputs: new BrowserAudioInputDeviceService()
  };
}
