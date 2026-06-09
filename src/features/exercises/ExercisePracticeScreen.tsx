import {
  ArrowLeft,
  Gauge,
  History,
  Mic2,
  Music2,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Trash2,
  Volume2
} from "lucide-react";
import { Dropdown, type DropdownOption } from "../../components/Dropdown";
import { FeedbackList } from "../../components/FeedbackList";
import { PitchTimeline } from "../../components/PitchTimeline";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { Toggle } from "../../components/ui/Toggle";
import { midiToNoteName } from "../../domain/music";
import { ThemePicker } from "../../app/ThemePicker";
import type { PitchCoachController } from "../../app/usePitchCoachController";

type ExercisePracticeScreenProps = {
  coach: PitchCoachController;
  activeThemeName: string;
  onBackToLibrary: () => void | Promise<void>;
  onOpenExercise: (exerciseId: PitchCoachController["selectedExercise"]["id"]) => void;
};

export function ExercisePracticeScreen({
  coach,
  activeThemeName,
  onBackToLibrary,
  onOpenExercise
}: ExercisePracticeScreenProps) {
  const primaryAction = coach.lessonState.status === "complete" ? coach.resetLesson : coach.startAttempt;
  const primaryLabel =
    coach.lessonState.status === "retry"
      ? coach.selectedExercise.id === "major-triad"
        ? "Retry triad"
        : "Retry exercise"
      : coach.lessonState.status === "complete"
        ? "Reset lesson"
        : "Start lesson";
  const exerciseOptions = coach.exercises.map((exercise) => ({
    value: exercise.id,
    label: exercise.title
  })) satisfies DropdownOption<PitchCoachController["selectedExercise"]["id"]>[];
  const noteOptions = coach.noteOptions.map((note) => ({
    value: note.midi,
    label: note.label
  })) satisfies DropdownOption<number>[];

  return (
    <main className="app-shell">
      <section className="coach-workspace" aria-label="Pitch coach exercise">
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
              <Mic2 size={22} />
            </div>
            <div className="brand-copy">
              <h1>Pitch Coach</h1>
              <p>{coach.selectedExercise.title}</p>
            </div>
          </div>
          <div className="top-actions">
            <ThemePicker
              value={coach.settings.themePreference}
              onValueChange={(themePreference) =>
                coach.setSettings({
                  ...coach.settings,
                  themePreference
                })
              }
            />
            <div className="session-readout" aria-live="polite">
              <span className="readout-label">Current key</span>
              <strong>{coach.currentKeyLabel}</strong>
            </div>
          </div>
        </header>

        <section className="practice-layout">
          <div className="lesson-panel">
            <div className="exercise-strip">
              <div className="exercise-select-card">
                <span className="readout-label">Exercise</span>
                <Dropdown
                  ariaLabel="Exercise"
                  value={coach.selectedExercise.id}
                  options={exerciseOptions}
                  onValueChange={onOpenExercise}
                  disabled={coach.isBusy}
                  triggerClassName="readout-dropdown-trigger"
                />
              </div>
              <div>
                <span className="readout-label">Pattern</span>
                <strong>{coach.exerciseLabel}</strong>
              </div>
              <div>
                <span className="readout-label">Attempt</span>
                <strong>{coach.lessonState.attemptNumber + 1}</strong>
              </div>
              <div>
                <span className="readout-label">Status</span>
                <strong>{statusCopy[coach.lessonState.status]}</strong>
              </div>
            </div>

            <PitchTimeline
              frames={coach.pitchFrames}
              targetNotes={coach.targetNotes}
              attemptScore={coach.attemptScore}
              totalDurationMs={coach.listeningDurationMs}
              toleranceCents={coach.settings.toleranceCents}
              status={coach.lessonState.status}
              themeName={activeThemeName}
            />

            <div className="transport-row">
              <Button
                className="primary-action"
                variant="primary"
                size="lg"
                onClick={() => void primaryAction()}
                disabled={coach.isBusy || coach.lessonState.status === "passed"}
                aria-label={primaryLabel}
                title={primaryLabel}
              >
                {coach.lessonState.status === "complete" ? <RotateCcw size={18} /> : <Play size={18} />}
                <span>{primaryLabel}</span>
              </Button>
              <IconButton
                size="lg"
                variant="toolbar"
                onClick={() => void coach.stopAttempt()}
                disabled={!coach.isBusy && coach.lessonState.status !== "passed"}
                aria-label="Stop"
                title="Stop"
              >
                <Square size={18} />
              </IconButton>
              <IconButton
                size="lg"
                variant="toolbar"
                onClick={() => void coach.resetLesson()}
                disabled={coach.isBusy}
                aria-label="Reset"
                title="Reset"
              >
                <RotateCcw size={18} />
              </IconButton>
            </div>

            {coach.errorMessage ? (
              <div className="error-banner" role="alert">
                {coach.errorMessage}
              </div>
            ) : null}
          </div>

          <aside className="side-panel" aria-label="Lesson controls and feedback">
            <section className="control-group" aria-label="Range">
              <div className="group-heading">
                <SlidersHorizontal size={17} />
                <h2>Range</h2>
              </div>
              <label>
                <span>Low</span>
                <Dropdown
                  ariaLabel="Low"
                  value={coach.settings.range.lowestMidi}
                  options={noteOptions}
                  onValueChange={(lowestMidi) =>
                    coach.setSettings({
                      ...coach.settings,
                      range: {
                        ...coach.settings.range,
                        lowestMidi
                      }
                    })
                  }
                />
              </label>
              <label>
                <span>High</span>
                <Dropdown
                  ariaLabel="High"
                  value={coach.settings.range.highestMidi}
                  options={noteOptions}
                  onValueChange={(highestMidi) =>
                    coach.setSettings({
                      ...coach.settings,
                      range: {
                        ...coach.settings.range,
                        highestMidi
                      }
                    })
                  }
                />
              </label>
            </section>

            <section className="control-group" aria-label="Scoring">
              <div className="group-heading">
                <Gauge size={17} />
                <h2>Scoring</h2>
              </div>
              <label>
                <span>Guide tempo</span>
                <input
                  type="range"
                  min="50"
                  max="140"
                  value={coach.settings.tempoBpm}
                  onChange={(event) =>
                    coach.setSettings({
                      ...coach.settings,
                      tempoBpm: Number(event.target.value)
                    })
                  }
                />
                <output>{coach.settings.tempoBpm} BPM</output>
              </label>
              <label>
                <span>Tolerance</span>
                <input
                  type="range"
                  min="15"
                  max="60"
                  value={coach.settings.toleranceCents}
                  onChange={(event) =>
                    coach.setSettings({
                      ...coach.settings,
                      toleranceCents: Number(event.target.value)
                    })
                  }
                />
                <output>{coach.settings.toleranceCents} cents</output>
              </label>
              <label className="toggle-row">
                <span>Local clips</span>
                <Toggle
                  aria-label="Local clips"
                  checked={coach.settings.saveLocalClips}
                  onChange={(saveLocalClips) =>
                    coach.setSettings({
                      ...coach.settings,
                      saveLocalClips
                    })
                  }
                />
              </label>
            </section>

            {coach.localClip || coach.clipErrorMessage ? (
              <section className="control-group" aria-label="Latest local clip">
                <div className="group-heading">
                  <Volume2 size={17} />
                  <h2>Latest Clip</h2>
                </div>
                {coach.localClip ? (
                  <>
                    <audio className="clip-player" controls src={coach.localClip.url} />
                    <div className="clip-actions">
                      <span>{formatClipDuration(coach.localClip.durationMs)}</span>
                      <Button
                        className="text-action"
                        variant="ghost"
                        size="sm"
                        onClick={() => void coach.deleteLocalClip()}
                      >
                        <Trash2 size={16} />
                        <span>Delete</span>
                      </Button>
                    </div>
                  </>
                ) : null}
                {coach.clipErrorMessage ? (
                  <p className="clip-error" role="alert">
                    {coach.clipErrorMessage}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="feedback-panel" aria-label="Attempt feedback">
              <div className="group-heading">
                <Music2 size={17} />
                <h2>Feedback</h2>
              </div>
              <p className="coach-summary">
                {coach.attemptScore?.summary ??
                  `Sing ${coach.targetNotes.map((note) => midiToNoteName(note.midi)).join(" - ")} after the guide.`}
              </p>
              <FeedbackList targetNotes={coach.targetNotes} attemptScore={coach.attemptScore} />
            </section>

            <section className="control-group history-panel" aria-label="Attempt history">
              <div className="group-heading">
                <History size={17} />
                <h2>History</h2>
              </div>
              {coach.selectedExerciseHistory.length > 0 ? (
                <ol className="history-list">
                  {coach.selectedExerciseHistory.map((attempt) => (
                    <li key={attempt.id}>
                      <span className={`history-result ${attempt.passed ? "history-pass" : "history-fail"}`}>
                        {attempt.passed ? "Pass" : "Retry"}
                      </span>
                      <span className="history-copy">
                        <strong>
                          {midiToNoteName(attempt.rootMidi)} major · {formatHistoryDate(attempt.createdAt)}
                        </strong>
                        <span>{attempt.summary}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="history-empty">No attempts yet for this exercise.</p>
              )}
              <Button
                className="text-action"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm("Clear all local attempt history?")) {
                    void coach.clearLocalAttemptHistory();
                  }
                }}
                disabled={coach.attemptHistoryCount === 0}
              >
                <Trash2 size={16} />
                <span>Clear history</span>
              </Button>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}

const statusCopy = {
  idle: "Ready",
  promptPlaying: "Prompt",
  awaitingVoice: "Waiting for voice",
  listening: "Listening",
  scoring: "Scoring",
  passed: "Passed",
  retry: "Retry",
  complete: "Complete"
} as const;

function formatClipDuration(durationMs: number) {
  return `${Math.max(0, durationMs / 1000).toFixed(1)}s`;
}

function formatHistoryDate(createdAt: string) {
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) {
    return "Unknown time";
  }

  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
