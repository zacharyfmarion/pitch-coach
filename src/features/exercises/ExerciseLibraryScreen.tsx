import { Mic2, Music2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import type {
  ExerciseProgressSummary,
  NoteAssessmentStatus
} from "../../domain/contracts";
import { ThemePicker } from "../../app/ThemePicker";
import type { PitchCoachController } from "../../app/usePitchCoachController";

type ExerciseLibraryScreenProps = {
  coach: PitchCoachController;
  onOpenExercise: (exerciseId: PitchCoachController["selectedExercise"]["id"]) => void;
  onOpenSongs: () => void;
};

export function ExerciseLibraryScreen({
  coach,
  onOpenExercise,
  onOpenSongs
}: ExerciseLibraryScreenProps) {
  return (
    <main className="app-shell">
      <section className="coach-workspace" aria-label="Pitch coach exercises">
        <header className="top-bar">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              <Mic2 size={22} />
            </div>
            <div className="brand-copy">
              <h1>Pitch Coach</h1>
              <p>Vocal exercise library</p>
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
            <Button
              className="mode-action"
              variant="secondary"
              size="md"
              onClick={onOpenSongs}
            >
              <Music2 size={16} />
              <span>Song mode</span>
            </Button>
          </div>
        </header>

        <ExerciseLibrary
          exercises={coach.exercises}
          selectedExerciseId={coach.selectedExercise.id}
          exerciseProgress={coach.exerciseProgress}
          onSelectExercise={onOpenExercise}
          disabled={coach.isBusy}
        />
      </section>
    </main>
  );
}

type ExerciseLibraryProps = {
  exercises: PitchCoachController["exercises"];
  selectedExerciseId: PitchCoachController["selectedExercise"]["id"];
  exerciseProgress: PitchCoachController["exerciseProgress"];
  onSelectExercise: (exerciseId: PitchCoachController["selectedExercise"]["id"]) => void;
  disabled: boolean;
};

function ExerciseLibrary({
  exercises,
  selectedExerciseId,
  exerciseProgress,
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
                <span className="exercise-progress">
                  {formatProgressSummary(exerciseProgress[exercise.id])}
                </span>
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

function formatProgressSummary(progress: ExerciseProgressSummary) {
  if (progress.attemptCount === 0 || progress.recentPassRate === undefined) {
    return "No attempts yet";
  }

  const issue = progress.commonIssue ? ` · Issue: ${describeIssue(progress.commonIssue)}` : "";
  return `${progress.recentPassRate}% recent pass · ${formatLastPracticed(
    progress.lastPracticedAt
  )}${issue}`;
}

function formatLastPracticed(createdAt: string | undefined) {
  if (!createdAt) {
    return "Last unknown";
  }

  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) {
    return "Last unknown";
  }

  const elapsedMs = Date.now() - timestamp;
  const elapsedDays = Math.floor(elapsedMs / 86400000);
  if (elapsedDays <= 0) {
    return "Last today";
  }
  if (elapsedDays === 1) {
    return "Last yesterday";
  }
  if (elapsedDays < 14) {
    return `Last ${elapsedDays}d ago`;
  }

  return `Last ${new Date(timestamp).toLocaleDateString([], {
    month: "short",
    day: "numeric"
  })}`;
}

function describeIssue(status: NoteAssessmentStatus) {
  switch (status) {
    case "flat":
      return "flat";
    case "sharp":
      return "sharp";
    case "wrongNote":
      return "wrong note";
    case "unstable":
      return "unstable";
    case "unclear":
      return "unclear";
    case "missed":
      return "missed";
    case "pass":
    case "passWithWarning":
      return "none";
  }
}
