import { PitchyPitchDetectorAdapter } from "../audio/pitchyDetector";
import { decodeSongFile } from "./audioData";
import { BrowserSongPracticeEngine } from "./practiceEngine";
import { detectSongRuntimeSupport } from "./support";
import { BasicPitchSongTranscriptionService } from "./transcriptionService";
import type { SongModeServices } from "./types";
import { DemucsWebVocalSeparator } from "./vocalSeparation";

export function createSongModeServices(): SongModeServices {
  return {
    detectSupport: detectSongRuntimeSupport,
    decodeFile: decodeSongFile,
    separator: new DemucsWebVocalSeparator(),
    transcriber: new BasicPitchSongTranscriptionService(),
    practiceEngine: new BrowserSongPracticeEngine(),
    detector: new PitchyPitchDetectorAdapter({
      clarityThreshold: 0.66,
      rmsThreshold: 0.005
    })
  };
}
