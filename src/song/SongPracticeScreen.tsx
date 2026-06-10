import {
  ArrowLeft,
  Bug,
  CheckCircle2,
  Clock3,
  FileAudio,
  Gauge,
  Headphones,
  Music2,
  Pause,
  Play,
  SlidersHorizontal,
  Square,
  Upload
} from "lucide-react";
import { useMemo, useState } from "react";
import { usePitchCoachTheme } from "../app/theme";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { CoachBubble } from "../components/ui/CoachBubble";
import { Dropzone } from "../components/ui/Dropzone";
import { IconButton } from "../components/ui/IconButton";
import { ProgressBar } from "../components/ui/ProgressBar";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { StatusPill } from "../components/ui/StatusPill";
import { Toggle } from "../components/ui/Toggle";
import { createSongDebugInfo, createVocalEnergyTrace } from "./debugDiagnostics";
import { formatSongReferenceRange } from "./referenceRange";
import { SongPitchTimeline } from "./SongPitchTimeline";
import {
  SONG_SECTION_LIMITS,
  useSongPracticeController,
  type SongPracticeStage
} from "./useSongPracticeController";
import type { SongModeServices } from "./types";

export type SongPracticeScreenProps = {
  services?: SongModeServices;
  onBackToLibrary: () => void | Promise<void>;
};

export function SongPracticeScreen({ services, onBackToLibrary }: SongPracticeScreenProps) {
  const song = useSongPracticeController({ services });
  const theme = usePitchCoachTheme(song.themePreference);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const isActivePractice = song.stage === "practicing" || song.stage === "paused";
  const pauseResumeLabel = song.stage === "paused" ? "Resume" : "Pause";
  const durationMs = song.reference?.durationMs ?? song.selectedDurationMs ?? SONG_SECTION_LIMITS.defaultMs;
  const debugEnergy = useMemo(
    () => (debugEnabled ? createVocalEnergyTrace(song.separation?.vocals ?? null) : []),
    [debugEnabled, song.separation?.vocals]
  );
  const debugInfo = useMemo(
    () =>
      debugEnabled
        ? createSongDebugInfo({
            reference: song.reference,
            vocals: null,
            vocalEnergy: debugEnergy,
            totalDurationMs: Math.max(durationMs, 1000),
            currentTimeMs: song.currentPlaybackTimeMs,
            isPlaying: song.stage === "practicing",
            trimStartMs: song.trimStartMs
          })
        : null,
    [
      debugEnabled,
      debugEnergy,
      durationMs,
      song.currentPlaybackTimeMs,
      song.reference,
      song.stage,
      song.trimStartMs
    ]
  );
  const songStatusView = createSongStatusView(song.stage);
  const pipelineSteps = createSongPipelineSteps(song);

  return (
    <main className="app-shell">
      <section className="coach-workspace" aria-label="Song practice">
        <header className="top-bar">
          <div className="brand-lockup">
            <IconButton
              className="back-action"
              size="sm"
              onClick={() => void onBackToLibrary()}
              aria-label="Back to exercises"
              title="Back to exercises"
            >
              <ArrowLeft size={18} />
            </IconButton>
            <div className="brand-mark" aria-hidden="true">
              <Music2 size={22} />
            </div>
            <div className="brand-copy">
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
            <SongStagePanel
              song={song}
              statusView={songStatusView}
              pipelineSteps={pipelineSteps}
            />

            <SongPitchTimeline
              reference={song.reference}
              liveFrames={song.liveFrames}
              score={song.score}
              totalDurationMs={Math.max(durationMs, 1000)}
              currentTimeMs={song.currentPlaybackTimeMs}
              isPlaying={song.stage === "practicing"}
              themeName={theme.name}
              debugEnabled={debugEnabled}
              debugEnergy={debugEnergy}
            />

            <div className="transport-row">
              <Button
                className="primary-action"
                variant="primary"
                size="lg"
                onClick={() => void song.startPractice()}
                disabled={!song.canPractice || song.stage === "practicing"}
                aria-label="Start song practice"
                title="Start song practice"
              >
                <Play size={18} />
                <span>Start practice</span>
              </Button>
              <IconButton
                size="lg"
                variant="toolbar"
                onClick={() =>
                  song.stage === "paused" ? void song.resumePractice() : void song.pausePractice()
                }
                disabled={!isActivePractice}
                aria-label={pauseResumeLabel}
                title={pauseResumeLabel}
              >
                {song.stage === "paused" ? <Play size={18} /> : <Pause size={18} />}
              </IconButton>
              <IconButton
                size="lg"
                variant="toolbar"
                onClick={() => void song.stopPractice()}
                disabled={!isActivePractice}
                aria-label="Stop"
                title="Stop"
              >
                <Square size={18} />
              </IconButton>
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
                {song.decodedAudio ? (
                  <section className="control-group" aria-label="Song section">
                    <div className="group-heading">
                      <Clock3 size={17} />
                      <h2>Section</h2>
                    </div>
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
                  </section>
                ) : null}

                <section className="control-group" aria-label="Song analysis">
                  <div className="group-heading">
                    <SlidersHorizontal size={17} />
                    <h2>Analysis</h2>
                  </div>
                  <div className="analysis-meter">
                    <span>Model</span>
                    <ProgressBar
                      value={song.analysisProgress.modelProgress * 100}
                      max={100}
                      tone="song"
                      aria-label="Model progress"
                    />
                    <span>{Math.round(song.analysisProgress.modelProgress * 100)}%</span>
                  </div>
                  <div className="analysis-meter">
                    <span>Vocals</span>
                    <ProgressBar
                      value={song.analysisProgress.separationProgress * 100}
                      max={100}
                      tone="song"
                      aria-label="Vocal separation progress"
                    />
                    <span>{Math.round(song.analysisProgress.separationProgress * 100)}%</span>
                  </div>
                  <div className="analysis-meter">
                    <span>Notes</span>
                    <ProgressBar
                      value={song.analysisProgress.transcriptionProgress * 100}
                      max={100}
                      tone="song"
                      aria-label="Note mapping progress"
                    />
                    <span>{Math.round(song.analysisProgress.transcriptionProgress * 100)}%</span>
                  </div>
                  <SegmentedControl
                    aria-label="Reference detail"
                    options={song.referenceDetailOptions}
                    value={song.referenceDetail}
                    onChange={song.setReferenceDetail}
                    disabled={song.isBusy}
                  />
                  <p className="history-empty">{song.analysisProgress.status}</p>
                  {song.reference ? (
                    <div className="reference-quality">
                      <span>{formatCount(song.reference.quality.noteCount, "note")}</span>
                      <span>{formatCount(song.reference.phrases.length, "phrase")}</span>
                      <span>{song.reference.quality.lowConfidenceCount} low confidence</span>
                      <span>range {formatSongReferenceRange(song.reference.analysisRange)}</span>
                      {song.reference.quality.suggestion ? (
                        <p className="history-empty">{song.reference.quality.suggestion}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <label className="toggle-row song-debug-toggle">
                    <span>Debug note timing</span>
                    <Toggle
                      aria-label="Debug note timing"
                      checked={debugEnabled}
                      onChange={setDebugEnabled}
                      disabled={!song.reference}
                    />
                  </label>
                </section>

                {debugEnabled && song.reference && debugInfo ? (
                  <section className="control-group song-debug-panel" aria-label="Song debug audit">
                    <div className="group-heading">
                      <Bug size={17} />
                      <h2>Debug Audit</h2>
                    </div>
                    <div className="song-debug-readout">
                      <span>Relative</span>
                      <strong>
                        {formatDuration(debugInfo.viewport.startMs)}-{formatDuration(debugInfo.viewport.endMs)}
                      </strong>
                      <span>Original</span>
                      <strong>
                        {formatDuration(debugInfo.originalViewport.startMs)}-
                        {formatDuration(debugInfo.originalViewport.endMs)}
                      </strong>
                      <span>Visible</span>
                      <strong>{formatCount(debugInfo.visibleNotes.length, "note")}</strong>
                      <span>Energy peak</span>
                      <strong>{formatDecimal(debugInfo.visibleEnergyPeak)}</strong>
                    </div>
                    {debugInfo.visibleNotes.length > 0 ? (
                      <ol className="song-debug-note-list">
                        {debugInfo.visibleNotes.slice(0, 12).map((note) => (
                          <li key={note.id}>
                            <strong>
                              {formatDuration(note.relativeStartMs)}-{formatDuration(note.relativeEndMs)}
                            </strong>
                            <span>
                              song {formatDuration(note.originalStartMs)}-{formatDuration(note.originalEndMs)}
                            </span>
                            <span>
                              {note.noteName} MIDI {note.midi}
                            </span>
                            <span>
                              conf {formatDecimal(note.confidence)} amp {formatDecimal(note.amplitude)}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="history-empty">No rendered reference notes in this viewport.</p>
                    )}
                  </section>
                ) : null}

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

type SongStatusView = {
  label: string;
  detail: string;
  tone: "idle" | "active" | "success" | "warning" | "danger" | "info";
  bubbleTone: "accent" | "success" | "warning" | "info";
  pulse?: boolean;
};

type SongPipelineStep = {
  id: string;
  label: string;
  detail: string;
  progress: number;
};

type SongController = ReturnType<typeof useSongPracticeController>;

function SongStagePanel({
  song,
  statusView,
  pipelineSteps
}: {
  song: SongController;
  statusView: SongStatusView;
  pipelineSteps: SongPipelineStep[];
}) {
  if (song.stage === "unsupported") {
    return (
      <section className="song-stage-panel" aria-label="Song setup">
        <CoachBubble tone="warning" icon={<Headphones size={18} />}>
          <strong>Song mode unavailable</strong>
          <span>WebGPU and cross-origin isolation are required for local vocal isolation.</span>
        </CoachBubble>
      </section>
    );
  }

  if (song.stage === "analyzing") {
    return (
      <section className="song-stage-panel" aria-label="Song setup">
        <Card className="song-pipeline-card" tone="song" padding="lg">
          <CardHeader>
            <div className="song-stage-heading">
              <StatusPill tone={statusView.tone} pulse={statusView.pulse}>
                {statusView.label}
              </StatusPill>
              <span>{song.analysisProgress.status}</span>
            </div>
            <CardTitle>Mapping the vocal</CardTitle>
            <CardDescription>
              The selected section is being separated and transcribed locally in this browser.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="song-pipeline-steps">
              {pipelineSteps.map((step) => (
                <div key={step.id} className="song-pipeline-step">
                  <div>
                    <strong>{step.label}</strong>
                    <span>{step.detail}</span>
                  </div>
                  <ProgressBar
                    value={step.progress}
                    max={100}
                    tone="song"
                    aria-label={`${step.label} progress`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (song.reference) {
    return (
      <section className="song-stage-panel" aria-label="Song setup">
        <Card className="song-ready-card" tone="song" padding="lg">
          <CardHeader>
            <div className="song-stage-heading">
              <StatusPill tone={statusView.tone} pulse={statusView.pulse}>
                {statusView.label}
              </StatusPill>
              <span>{statusView.detail}</span>
            </div>
            <CardTitle>{song.fileName ?? "Song practice"}</CardTitle>
            <CardDescription>
              Follow the mapped vocal contour, then compare your live pitch against the reference.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="song-ready-chips">
              <Chip tone="song" size="sm">
                <Music2 size={13} />
                {formatMappedNoteCount(song.reference.quality.noteCount)}
              </Chip>
              <Chip tone="accent" size="sm">
                <FileAudio size={13} />
                {formatCount(song.reference.phrases.length, "phrase")}
              </Chip>
              <Chip tone="neutral" size="sm">
                {formatSongReferenceRange(song.reference.analysisRange)} vocal range
              </Chip>
              <Chip tone={song.reference.quality.lowConfidenceCount > 0 ? "warning" : "success"} size="sm">
                {song.reference.quality.lowConfidenceCount} low confidence
              </Chip>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  const isDecoding = song.stage === "decoding";
  const hasDecodedAudio = song.decodedAudio !== null;
  return (
    <section className="song-stage-panel" aria-label="Song setup">
      <Dropzone
        tone="song"
        isActive={isDecoding}
        icon={hasDecodedAudio ? <CheckCircle2 size={24} /> : <Upload size={24} />}
        title={song.fileName ?? "Upload a local song"}
        description={
          hasDecodedAudio
            ? `Selected section: ${formatDuration(song.selectedDurationMs)}`
            : "Choose a short audio section, map the vocal, then practice against it."
        }
        action={
          <div className="song-stage-actions">
            <label className="song-upload-button">
              <Upload size={16} />
              <span>{hasDecodedAudio ? "Replace audio" : "Choose audio"}</span>
              <input
                type="file"
                accept="audio/*"
                aria-label="Audio"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) {
                    void song.chooseFile(file);
                  }
                }}
                disabled={song.isBusy}
              />
            </label>
            {hasDecodedAudio ? (
              <Button
                variant="song"
                size="md"
                onClick={() => void song.analyzeSong()}
                disabled={!song.canAnalyze}
              >
                <Music2 size={16} />
                <span>Analyze song</span>
              </Button>
            ) : null}
          </div>
        }
        privacyNote="Audio stays on this device while the browser isolates and maps the vocal."
      />
    </section>
  );
}

function createSongStatusView(stage: SongPracticeStage): SongStatusView {
  switch (stage) {
    case "checking":
      return {
        label: "Checking",
        detail: "Verifying local song runtime support.",
        tone: "info",
        bubbleTone: "info",
        pulse: true
      };
    case "unsupported":
      return {
        label: "Unavailable",
        detail: "Local song processing is not available in this browser.",
        tone: "danger",
        bubbleTone: "warning"
      };
    case "decoding":
      return {
        label: "Loading",
        detail: "Decoding the selected audio file.",
        tone: "active",
        bubbleTone: "accent",
        pulse: true
      };
    case "decoded":
      return {
        label: "Ready to map",
        detail: "Choose the section and analyze the vocal.",
        tone: "info",
        bubbleTone: "info"
      };
    case "analyzing":
      return {
        label: "Analyzing",
        detail: "Separating and mapping the vocal locally.",
        tone: "active",
        bubbleTone: "accent",
        pulse: true
      };
    case "ready":
      return {
        label: "Ready",
        detail: "Press Start practice when you are set.",
        tone: "success",
        bubbleTone: "success"
      };
    case "practicing":
      return {
        label: "Singing",
        detail: "Live pitch is being compared locally.",
        tone: "active",
        bubbleTone: "accent",
        pulse: true
      };
    case "paused":
      return {
        label: "On pause",
        detail: "Resume when you are ready.",
        tone: "warning",
        bubbleTone: "warning"
      };
    case "complete":
      return {
        label: "Complete",
        detail: "Review the score or start another pass.",
        tone: "success",
        bubbleTone: "success"
      };
    case "error":
      return {
        label: "Needs attention",
        detail: "Check the message below and try again.",
        tone: "danger",
        bubbleTone: "warning"
      };
    case "empty":
    default:
      return {
        label: "Upload",
        detail: "Choose audio to start song practice.",
        tone: "idle",
        bubbleTone: "accent"
      };
  }
}

function createSongPipelineSteps(song: SongController): SongPipelineStep[] {
  return [
    {
      id: "load",
      label: "Load track",
      detail: song.fileName ?? "Waiting for audio",
      progress: song.decodedAudio ? 100 : song.stage === "decoding" ? 50 : 0
    },
    {
      id: "model",
      label: "Get model",
      detail: "Vocal isolation runtime",
      progress: Math.round(song.analysisProgress.modelProgress * 100)
    },
    {
      id: "separate",
      label: "Separate vocals",
      detail: "Local accompaniment and vocal stems",
      progress: Math.round(song.analysisProgress.separationProgress * 100)
    },
    {
      id: "map",
      label: "Map vocal",
      detail: song.referenceDetail,
      progress: Math.round(song.analysisProgress.transcriptionProgress * 100)
    }
  ];
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
    case "paused":
      return "Paused";
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

function formatCount(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function formatMappedNoteCount(count: number) {
  return `${count} mapped note${count === 1 ? "" : "s"}`;
}

function formatDecimal(value: number) {
  return value.toFixed(3);
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
