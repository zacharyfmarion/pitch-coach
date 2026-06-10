import {
  Bug,
  CheckCircle2,
  Clock3,
  FileAudio,
  Gauge,
  Headphones,
  Lock,
  Mic,
  Music2,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Upload
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePitchCoachTheme } from "../app/theme";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
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
import type { SongModeServices, SongRuntimeSupport } from "./types";

export type SongPracticeScreenProps = {
  services?: SongModeServices;
};

export function SongPracticeScreen({ services }: SongPracticeScreenProps) {
  const song = useSongPracticeController({ services });
  const theme = usePitchCoachTheme(song.themePreference);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const isActivePractice = song.stage === "practicing" || song.stage === "paused";
  const pauseResumeLabel = song.stage === "paused" ? "Resume" : "Pause";
  const durationMs = song.reference?.durationMs ?? song.selectedDurationMs ?? SONG_SECTION_LIMITS.defaultMs;
  const autoAnalyzeKeyRef = useRef<string | null>(null);
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
  const hasLoadedSong = Boolean(song.fileName || song.decodedAudio || song.reference);
  const isProcessingSong =
    hasLoadedSong && !song.reference && (song.stage === "decoding" || song.stage === "decoded" || song.stage === "analyzing");
  const shouldAutoAnalyze =
    song.stage === "decoded" &&
    song.canAnalyze &&
    !song.analysisProgress.status.toLowerCase().includes("analyze song again");
  const autoAnalyzeKey = `${song.fileName ?? "song"}:${song.decodedAudio?.durationMs ?? 0}:${song.referenceDetail}`;

  useEffect(() => {
    if (!shouldAutoAnalyze || autoAnalyzeKeyRef.current === autoAnalyzeKey) {
      return;
    }

    autoAnalyzeKeyRef.current = autoAnalyzeKey;
    void song.analyzeSong();
  }, [autoAnalyzeKey, shouldAutoAnalyze, song.analyzeSong]);

  if (!hasLoadedSong || song.stage === "checking" || song.stage === "unsupported") {
    return (
      <main className="mock-song-page mock-song-page--empty" aria-label="Song practice">
        <SongMockHeader />
        <SongEmptyState
          isChecking={song.stage === "checking"}
          onChooseFile={(file) => void song.chooseFile(file)}
        />
      </main>
    );
  }

  if (isProcessingSong || song.stage === "error") {
    return (
      <main className="mock-song-page mock-song-page--processing" aria-label="Song practice">
        <SongMockHeader showReset onReset={() => void song.resetSong()} />
        <SongProcessingState
          fileName={song.fileName}
          stage={song.stage}
          progress={createSongProcessingProgress(song)}
          steps={pipelineSteps}
          errorMessage={song.errorMessage}
          status={song.analysisProgress.status}
          support={song.support}
        />
      </main>
    );
  }

  return (
    <main className="mock-song-page mock-song-page--loaded" aria-label="Song practice">
      <SongMockHeader showReset onReset={() => void song.resetSong()} />

      <section className="mock-song-layout">
        <div className="mock-song-workbench">
          <SongStagePanel
            song={song}
            statusView={songStatusView}
            pipelineSteps={pipelineSteps}
          />

          <section className="mock-song-timeline-card" aria-label="Reference pitch map">
            <div className="mock-song-card-heading">
              <div>
                <h2>Reference pitch map</h2>
                <p>{song.reference ? "Sing with the mapped vocal contour." : "Upload a song to reveal the vocal contour."}</p>
              </div>
              <StatusPill tone={songStatusView.tone} pulse={songStatusView.pulse}>
                {songStatusView.label}
              </StatusPill>
            </div>
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
          </section>

          <div className="mock-song-transport">
            <Button
              className="primary-action"
              variant="song"
              size="lg"
              onClick={() => void song.startPractice()}
              disabled={!song.canPractice || song.stage === "practicing"}
              aria-label="Start song practice"
              title="Start song practice"
            >
              <Play size={18} />
              <span>Start practice</span>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() =>
                song.stage === "paused" ? void song.resumePractice() : void song.pausePractice()
              }
              disabled={!isActivePractice}
              aria-label={pauseResumeLabel}
              title={pauseResumeLabel}
            >
              {song.stage === "paused" ? <Play size={18} /> : <Pause size={18} />}
              <span>{pauseResumeLabel}</span>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => void song.stopPractice()}
              disabled={!isActivePractice}
              aria-label="Stop"
              title="Stop"
            >
              <Square size={18} />
              <span>Stop</span>
            </Button>
          </div>

          {song.errorMessage ? (
            <div className="error-banner" role="alert">
              {song.errorMessage}
            </div>
          ) : null}
        </div>

        <aside className="mock-song-side-panel" aria-label="Song controls and feedback">
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
        </aside>
      </section>
    </main>
  );
}

function SongMockHeader({
  showReset = false,
  onReset
}: {
  showReset?: boolean;
  onReset?: () => void;
}) {
  return (
    <section className="mock-song-page__header">
      <div className="mock-song-title">
        <span className="mock-song-title__icon" aria-hidden="true">
          <Mic size={30} />
        </span>
        <div>
          <h1>Sing a Song</h1>
          <p>Upload any track — we isolate the vocal and turn it into pitch targets you can sing.</p>
        </div>
      </div>
      {showReset ? (
        <button className="mock-song-reset-button" type="button" onClick={onReset}>
          <RotateCcw size={19} aria-hidden="true" />
          <span>Try another song</span>
        </button>
      ) : null}
    </section>
  );
}

function SongEmptyState({
  isChecking,
  onChooseFile
}: {
  isChecking: boolean;
  onChooseFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <section className="mock-song-empty">
      <div className="mock-song-empty__drop" aria-label="Song upload">
        <span className="mock-song-empty__upload-icon" aria-hidden="true">
          <Upload size={43} />
        </span>
        <h2>Drop a song here</h2>
        <p>
          or <span>browse your files</span> — MP3, WAV or M4A.
        </p>
        <button
          className="mock-song-empty__button"
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isChecking}
        >
          <Upload size={21} aria-hidden="true" />
          <span>{isChecking ? "Checking support" : "Choose a file"}</span>
        </button>
        <input
          ref={inputRef}
          className="mock-song-empty__input"
          type="file"
          accept="audio/*"
          aria-label="Audio"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) {
              onChooseFile(file);
            }
          }}
          disabled={isChecking}
        />
        <span className="mock-song-empty__privacy">Everything runs on your device — nothing is uploaded.</span>
      </div>
      <SongHowItWorks />
    </section>
  );
}

function SongHowItWorks() {
  const steps = [
    { id: "load", label: "Load track", detail: "Read your audio file" },
    { id: "model", label: "Get stem model", detail: "Download if not cached" },
    { id: "separate", label: "Separate stems", detail: "Vocals from instrumental" },
    { id: "map", label: "Map the vocal", detail: "Into note targets to sing" }
  ];

  return (
    <section className="mock-song-how">
      <h2>How it works · about a minute, on your device</h2>
      <ol>
        {steps.map((step, index) => (
          <li key={step.id}>
            <span className="mock-song-how__number">{index + 1}</span>
            <div>
              <strong>{step.label}</strong>
              <span>{step.detail}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SongProcessingState({
  fileName,
  stage,
  progress,
  steps,
  errorMessage,
  status,
  support
}: {
  fileName: string | null;
  stage: SongPracticeStage;
  progress: number;
  steps: SongPipelineStep[];
  errorMessage: string | null;
  status: string;
  support: SongRuntimeSupport;
}) {
  const activeDetail = createSongProcessingDetail(stage, status, support.supported);
  return (
    <section className="mock-song-processing-card" aria-label="Song processing">
      <div className="mock-song-processing-card__header">
        <span className="mock-song-processing-card__icon" aria-hidden="true">
          <SongWaveGlyph />
        </span>
        <div>
          <h2>{fileName ?? "song.mp3"}</h2>
          <p>{activeDetail}</p>
        </div>
        <strong>{progress}%</strong>
      </div>
      <div className="mock-song-processing-card__bar" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <ol className="mock-song-processing-steps">
        {steps.map((step, index) => {
          const state = createProcessingStepState(step, stage, support.supported);
          return (
            <li key={step.id} className={`mock-song-processing-step is-${state}`}>
              <span>{state === "done" ? <CheckCircle2 size={24} /> : index + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <p>{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mock-song-processing-card__privacy">
        <Lock size={18} aria-hidden="true" />
        <span>Audio never leaves this device. The stem model is cached after the first run, so next time is faster.</span>
      </p>
      {errorMessage ? <div className="error-banner" role="alert">{errorMessage}</div> : null}
      {!support.supported ? (
        <div className="error-banner" role="alert">
          Song mode needs WebGPU and cross-origin isolation to process this track locally.
        </div>
      ) : null}
    </section>
  );
}

function createSongProcessingProgress(song: SongController) {
  if (song.stage === "error") {
    return Math.max(0, Math.round((song.analysisProgress.modelProgress + song.analysisProgress.separationProgress) * 25));
  }

  const load = song.decodedAudio ? 1 : song.stage === "decoding" ? 0.4 : 0;
  const model = song.analysisProgress.modelProgress;
  const separation = song.analysisProgress.separationProgress;
  const transcription = song.analysisProgress.transcriptionProgress;
  return Math.min(99, Math.max(5, Math.round(((load + model + separation + transcription) / 4) * 100)));
}

function createSongProcessingDetail(stage: SongPracticeStage, status: string, isSupported: boolean) {
  const normalizedStatus = status.trim();
  if (!isSupported) {
    return "Waiting for local song processing support...";
  }

  if (stage === "decoding") {
    return "Processing — read audio file...";
  }

  if (stage === "decoded") {
    if (/analyze|transcription engine|changed/i.test(normalizedStatus)) {
      return normalizedStatus;
    }

    return "Processing — prepare stems...";
  }

  if (stage === "analyzing") {
    return normalizedStatus || "Processing — separate stems...";
  }

  if (stage === "error") {
    return "Processing needs attention.";
  }

  return "Processing — separate stems...";
}

function createProcessingStepState(
  step: SongPipelineStep,
  stage: SongPracticeStage,
  isSupported: boolean
): "done" | "active" | "pending" {
  if (!isSupported && step.id !== "load") {
    return "pending";
  }

  if (step.id === "load") {
    return stage === "decoding" ? "active" : "done";
  }

  if (step.progress >= 100) {
    return "done";
  }

  if (stage === "analyzing" && step.id === "model") {
    return step.progress > 0 ? "active" : "pending";
  }

  if (stage === "analyzing" && step.id === "separate") {
    return step.progress > 0 ? "active" : "pending";
  }

  if (stage === "analyzing" && step.id === "map") {
    return step.progress > 0 ? "active" : "pending";
  }

  if (stage === "decoded" && step.id === "model") {
    return "active";
  }

  return "pending";
}

function SongWaveGlyph() {
  return (
    <svg viewBox="0 0 42 42" width="42" height="42" aria-hidden="true">
      <path
        d="M5 22h5l4-12 7 25 5-18 4 9h7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
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
        <div className="mock-song-unavailable-card">
          <span className="mock-song-unavailable-card__icon" aria-hidden="true">
            <Headphones size={23} />
          </span>
          <div>
            <h2>Song mode unavailable</h2>
            <p>WebGPU and cross-origin isolation are required for local vocal isolation.</p>
          </div>
        </div>
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

  return null;
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
