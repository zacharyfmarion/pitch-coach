import {
  ArrowLeft,
  Gauge,
  Headphones,
  Music2,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Upload
} from "lucide-react";
import { SongPitchTimeline } from "./SongPitchTimeline";
import { SONG_SECTION_LIMITS, useSongPracticeController } from "./useSongPracticeController";
import type { SongModeServices } from "./types";

export type SongPracticeScreenProps = {
  services?: SongModeServices;
  onBackToLibrary: () => void | Promise<void>;
};

export function SongPracticeScreen({ services, onBackToLibrary }: SongPracticeScreenProps) {
  const song = useSongPracticeController({ services });
  const durationMs = song.reference?.durationMs ?? song.selectedDurationMs ?? SONG_SECTION_LIMITS.defaultMs;

  return (
    <main className="app-shell">
      <section className="coach-workspace" aria-label="Song practice">
        <header className="top-bar">
          <div className="brand-lockup">
            <button
              className="icon-action back-action"
              type="button"
              onClick={() => void onBackToLibrary()}
              aria-label="Back to exercises"
              title="Back to exercises"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="brand-mark song-brand-mark" aria-hidden="true">
              <Music2 size={22} />
            </div>
            <div>
              <h1>Song Practice</h1>
              <p>{song.fileName ?? "Upload a local audio section"}</p>
            </div>
          </div>
          <div className="session-readout" aria-live="polite">
            <span className="readout-label">Mode</span>
            <strong>{formatStage(song.stage)}</strong>
          </div>
        </header>

        <section className="practice-layout song-practice-layout">
          <div className="lesson-panel song-workbench">
            <SongPitchTimeline
              reference={song.reference}
              liveFrames={song.liveFrames}
              score={song.score}
              totalDurationMs={Math.max(durationMs, 1000)}
            />

            <div className="transport-row">
              <button
                className="primary-action"
                type="button"
                onClick={() => void song.startPractice()}
                disabled={!song.canPractice || song.stage === "practicing"}
                aria-label="Start song practice"
                title="Start song practice"
              >
                <Play size={18} />
                <span>Start practice</span>
              </button>
              <button
                className="icon-action"
                type="button"
                onClick={() => void song.stopPractice()}
                disabled={song.stage !== "practicing"}
                aria-label="Stop"
                title="Stop"
              >
                <Square size={18} />
              </button>
              <button
                className="icon-action"
                type="button"
                onClick={() => void song.resetSong()}
                disabled={song.isBusy}
                aria-label="Reset song"
                title="Reset song"
              >
                <RotateCcw size={18} />
              </button>
            </div>

            {song.errorMessage ? (
              <div className="error-banner" role="alert">
                {song.errorMessage}
              </div>
            ) : null}
          </div>

          <aside className="side-panel" aria-label="Song controls and feedback">
            {song.stage === "unsupported" ? (
              <section className="control-group" aria-label="Song mode unavailable">
                <div className="group-heading">
                  <Headphones size={17} />
                  <h2>Unavailable</h2>
                </div>
                <p className="coach-summary">
                  Song mode needs WebGPU and cross-origin isolation to keep vocal isolation local.
                </p>
                <ul className="song-reason-list">
                  {song.support.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </section>
            ) : (
              <>
                <section className="control-group" aria-label="Upload song">
                  <div className="group-heading">
                    <Upload size={17} />
                    <h2>Upload</h2>
                  </div>
                  <label className="file-input-row">
                    <span>Audio</span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (file) {
                          void song.chooseFile(file);
                        }
                      }}
                      disabled={song.isBusy}
                    />
                  </label>
                  {song.decodedAudio ? (
                    <>
                      <label>
                        <span>Start</span>
                        <input
                          type="range"
                          min="0"
                          max={Math.max(1, song.decodedAudio.durationMs - 1000)}
                          value={song.trimStartMs}
                          onChange={(event) => song.setTrimStartMs(Number(event.target.value))}
                          disabled={song.isBusy}
                          aria-label="Section start"
                        />
                        <output>{formatDuration(song.trimStartMs)}</output>
                      </label>
                      <label>
                        <span>End</span>
                        <input
                          type="range"
                          min={Math.min(song.trimStartMs + 1000, song.decodedAudio.durationMs)}
                          max={Math.min(song.decodedAudio.durationMs, song.trimStartMs + SONG_SECTION_LIMITS.maxMs)}
                          value={song.trimEndMs}
                          onChange={(event) => song.setTrimEndMs(Number(event.target.value))}
                          disabled={song.isBusy}
                          aria-label="Section end"
                        />
                        <output>{formatDuration(song.trimEndMs)}</output>
                      </label>
                      <div className="song-section-readout">
                        <span>{formatDuration(song.selectedDurationMs)} selected</span>
                        <span>V1 target: 0:30-1:30</span>
                      </div>
                      <button
                        className="text-action song-full-action"
                        type="button"
                        onClick={() => void song.analyzeSong()}
                        disabled={!song.canAnalyze}
                      >
                        <Music2 size={16} />
                        <span>Analyze song</span>
                      </button>
                    </>
                  ) : null}
                </section>

                <section className="control-group" aria-label="Song analysis">
                  <div className="group-heading">
                    <SlidersHorizontal size={17} />
                    <h2>Analysis</h2>
                  </div>
                  <div className="analysis-meter">
                    <span>Model</span>
                    <progress value={song.analysisProgress.modelProgress} max="1" />
                    <span>{Math.round(song.analysisProgress.modelProgress * 100)}%</span>
                  </div>
                  <div className="analysis-meter">
                    <span>Vocals</span>
                    <progress value={song.analysisProgress.separationProgress} max="1" />
                    <span>{Math.round(song.analysisProgress.separationProgress * 100)}%</span>
                  </div>
                  <p className="history-empty">{song.analysisProgress.status}</p>
                  {song.reference ? (
                    <p className="coach-summary">
                      {song.reference.phrases.length} vocal phrases found in {formatDuration(song.reference.durationMs)}.
                    </p>
                  ) : null}
                </section>

                <section className="control-group" aria-label="Practice mix">
                  <div className="group-heading">
                    <Headphones size={17} />
                    <h2>Practice Mix</h2>
                  </div>
                  <label>
                    <span>Guide</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(song.vocalGuideGain * 100)}
                      onChange={(event) => song.setVocalGuideGain(Number(event.target.value) / 100)}
                      aria-label="Vocal guide"
                    />
                    <output>{Math.round(song.vocalGuideGain * 100)}%</output>
                  </label>
                  <label>
                    <span>Tolerance</span>
                    <input
                      type="range"
                      min="15"
                      max="60"
                      value={song.toleranceCents}
                      onChange={(event) => song.setToleranceCents(Number(event.target.value))}
                    />
                    <output>{song.toleranceCents} cents</output>
                  </label>
                </section>

                <section className="feedback-panel" aria-label="Song feedback">
                  <div className="group-heading">
                    <Gauge size={17} />
                    <h2>Feedback</h2>
                  </div>
                  <p className="coach-summary">
                    {song.score?.summary ?? "Analyze a local section, then sing with the accompaniment."}
                  </p>
                  {song.score ? (
                    <ol className="history-list song-region-list">
                      {song.score.regions
                        .filter((region) => region.status !== "inTune")
                        .slice(0, 5)
                        .map((region) => (
                          <li key={region.id}>
                            <span className="history-result history-fail">{formatRegionStatus(region.status)}</span>
                            <span className="history-copy">
                              <strong>{formatDuration(region.startMs)}</strong>
                              <span>{formatRegionDetail(region.medianCents)}</span>
                            </span>
                          </li>
                        ))}
                    </ol>
                  ) : null}
                </section>
              </>
            )}
          </aside>
        </section>
      </section>
    </main>
  );
}

function formatStage(stage: string) {
  switch (stage) {
    case "checking":
      return "Checking";
    case "unsupported":
      return "Unavailable";
    case "decoding":
      return "Decoding";
    case "decoded":
      return "Ready";
    case "analyzing":
      return "Analyzing";
    case "ready":
      return "Practice ready";
    case "practicing":
      return "Listening";
    case "complete":
      return "Complete";
    case "error":
      return "Needs attention";
    default:
      return "Upload";
  }
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatRegionStatus(status: string) {
  switch (status) {
    case "flat":
      return "Flat";
    case "sharp":
      return "Sharp";
    case "missed":
      return "Missed";
    case "unclear":
      return "Unclear";
    default:
      return "Issue";
  }
}

function formatRegionDetail(cents: number | undefined) {
  return cents === undefined ? "No clear sung pitch." : `${Math.round(Math.abs(cents))} cents off center.`;
}
