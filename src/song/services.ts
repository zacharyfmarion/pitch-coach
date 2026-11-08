import { PitchyPitchDetectorAdapter } from "../audio/pitchyDetector";
import { SPEAKER_PITCH_OPTIONS } from "../audio/speakerSettings";
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
    speakerDetector: new PitchyPitchDetectorAdapter(SPEAKER_PITCH_OPTIONS),
    detector: new PitchyPitchDetectorAdapter({
      clarityThreshold: 0.66,
      rmsThreshold: 0.005
    })
  };
}
