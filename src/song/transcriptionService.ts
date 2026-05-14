import type { SongReference, SongStereoBuffer, SongTranscriptionOptions, SongTranscriptionService } from "./types";

export class BasicPitchSongTranscriptionService implements SongTranscriptionService {
  async transcribe(vocals: SongStereoBuffer, options: SongTranscriptionOptions): Promise<SongReference> {
    const { transcribeWithBasicPitch } = await import("./basicPitchRuntime");
    return transcribeWithBasicPitch(vocals, options);
  }
}
