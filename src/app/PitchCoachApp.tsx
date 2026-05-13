import { useState } from "react";
import {
  ArrowLeft,
  Gauge,
  Mic2,
  Music2,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Trash2,
  Volume2
} from "lucide-react";
import { FeedbackList } from "../components/FeedbackList";
import { PitchTimeline } from "../components/PitchTimeline";
import { midiToNoteName } from "../domain/music";
import { usePitchCoachController, type PitchCoachControllerOptions } from "./usePitchCoachController";

export type PitchCoachAppProps = PitchCoachControllerOptions;

export function PitchCoachApp(props: PitchCoachAppProps) {
  const coach = usePitchCoachController(props);
  const [screen, setScreen] = useState<"library" | "practice">("library");

  const openExercise = (exerciseId: (typeof coach.exercises)[number]["id"]) => {
    coach.selectExercise(exerciseId);
    setScreen("practice");
  };

  const backToLibrary = async () => {
    await coach.stopAttempt();
    setScreen("library");
  };

  if (screen === "library") {
    return (
      <main className="app-shell">
        <section className="coach-workspace" aria-label="Pitch coach exercises">
          <header className="top-bar">
            <div className="brand-lockup">
              <div className="brand-mark" aria-hidden="true">
                <Mic2 size={22} />
              </div>
              <div>
                <h1>Pitch Coach</h1>
                <p>Vocal exercise library</p>
              </div>
            </div>
            <div className="session-readout" aria-live="polite">
              <span className="readout-label">Selected</span>
              <strong>{coach.selectedExercise.title}</strong>
            </div>
          </header>

          <ExerciseLibrary
            exercises={coach.exercises}
            selectedExerciseId={coach.selectedExercise.id}
            onSelectExercise={openExercise}
            disabled={coach.isBusy}
          />
        </section>
      </main>
    );
  }

  const primaryAction = coach.lessonState.status === "complete" ? coach.resetLesson : coach.startAttempt;
  const primaryLabel =
    coach.lessonState.status === "retry"
      ? coach.selectedExercise.id === "major-triad"
        ? "Retry triad"
        : "Retry exercise"
      : coach.lessonState.status === "complete"
        ? "Reset lesson"
        : "Start lesson";

  return (
    <main className="app-shell">
      <section className="coach-workspace" aria-label="Pitch coach exercise">
        <header className="top-bar">
          <div className="brand-lockup">
            <button
              className="icon-action back-action"
              type="button"
              onClick={() => void backToLibrary()}
              aria-label="Back to exercises"
              title="Back to exercises"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="brand-mark" aria-hidden="true">
              <Mic2 size={22} />
            </div>
            <div>
              <h1>Pitch Coach</h1>
              <p>{coach.selectedExercise.title}</p>
            </div>
          </div>
          <div className="session-readout" aria-live="polite">
            <span className="readout-label">Current key</span>
            <strong>{coach.currentKeyLabel}</strong>
          </div>
        </header>

        <section className="practice-layout">
          <div className="lesson-panel">
            <div className="exercise-strip">
              <div>
                <span className="readout-label">Exercise</span>
                <strong>{coach.selectedExercise.title}</strong>
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
            />

            <div className="transport-row">
              <button
                className="primary-action"
                type="button"
                onClick={() => void primaryAction()}
                disabled={coach.isBusy || coach.lessonState.status === "passed"}
                aria-label={primaryLabel}
                title={primaryLabel}
              >
                {coach.lessonState.status === "complete" ? <RotateCcw size={18} /> : <Play size={18} />}
                <span>{primaryLabel}</span>
              </button>
              <button
                className="icon-action"
                type="button"
                onClick={() => void coach.stopAttempt()}
                disabled={!coach.isBusy && coach.lessonState.status !== "passed"}
                aria-label="Stop"
                title="Stop"
              >
                <Square size={18} />
              </button>
              <button
                className="icon-action"
                type="button"
                onClick={() => void coach.resetLesson()}
                disabled={coach.isBusy}
                aria-label="Reset"
                title="Reset"
              >
                <RotateCcw size={18} />
              </button>
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
                <select
                  value={coach.settings.range.lowestMidi}
                  onChange={(event) =>
                    coach.setSettings({
                      ...coach.settings,
                      range: {
                        ...coach.settings.range,
                        lowestMidi: Number(event.target.value)
                      }
                    })
                  }
                >
                  {coach.noteOptions.map((note) => (
                    <option key={note.midi} value={note.midi}>
                      {note.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>High</span>
                <select
                  value={coach.settings.range.highestMidi}
                  onChange={(event) =>
                    coach.setSettings({
                      ...coach.settings,
                      range: {
                        ...coach.settings.range,
                        highestMidi: Number(event.target.value)
                      }
                    })
                  }
                >
                  {coach.noteOptions.map((note) => (
                    <option key={note.midi} value={note.midi}>
                      {note.label}
                    </option>
                  ))}
                </select>
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
                <input
                  type="checkbox"
                  checked={coach.settings.saveLocalClips}
                  onChange={(event) =>
                    coach.setSettings({
                      ...coach.settings,
                      saveLocalClips: event.target.checked
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
                      <button
                        className="text-action"
                        type="button"
                        onClick={() => void coach.deleteLocalClip()}
                      >
                        <Trash2 size={16} />
                        <span>Delete</span>
                      </button>
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

type ExerciseLibraryProps = {
  exercises: ReturnType<typeof usePitchCoachController>["exercises"];
  selectedExerciseId: ReturnType<typeof usePitchCoachController>["selectedExercise"]["id"];
  onSelectExercise: (exerciseId: ReturnType<typeof usePitchCoachController>["selectedExercise"]["id"]) => void;
  disabled: boolean;
};

function ExerciseLibrary({
  exercises,
  selectedExerciseId,
  onSelectExercise,
  disabled
}: ExerciseLibraryProps) {
  return (
    <section className="exercise-library" aria-label="Exercise library">
      <div className="library-heading">
        <div>
          <span className="readout-label">Exercises</span>
          <h2>Practice Library</h2>
        </div>
        <span>{exercises.length} drills</span>
      </div>
      <div className="exercise-list">
        {exercises.map((exercise) => {
          const isSelected = exercise.id === selectedExerciseId;
          return (
            <button
              key={exercise.id}
              className={`exercise-option ${isSelected ? "exercise-option-active" : ""}`}
              type="button"
              onClick={() => onSelectExercise(exercise.id)}
              aria-pressed={isSelected}
              disabled={disabled}
            >
              <span className="difficulty-meter" aria-label={`Difficulty ${exercise.difficulty} of 5`}>
                {Array.from({ length: 5 }, (_, index) => (
                  <span key={index} className={index < exercise.difficulty ? "difficulty-on" : ""} />
                ))}
              </span>
              <span className="exercise-copy">
                <strong>{exercise.title}</strong>
                <span>{exercise.description}</span>
              </span>
              <span className="exercise-meta">
                <span>{exercise.focus}</span>
                <span>{formatExercisePatternText(exercise.patternDegrees)}</span>
              </span>
              <span className="exercise-start">Start</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function formatExercisePatternText(patternDegrees: readonly number[]) {
  return patternDegrees.join("-");
}
