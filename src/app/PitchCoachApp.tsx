import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Gauge,
  History,
  Home,
  Layers3,
  Mic2,
  Monitor,
  Moon,
  Music2,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Square,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  Volume2
} from "lucide-react";
import { Dropdown, type DropdownOption } from "../components/Dropdown";
import { FeedbackList } from "../components/FeedbackList";
import { PitchTimeline } from "../components/PitchTimeline";
import { AppShell } from "../components/ui/AppShell";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { CoachBubble } from "../components/ui/CoachBubble";
import { IconButton } from "../components/ui/IconButton";
import { PageHeader } from "../components/ui/PageHeader";
import { SidebarNav } from "../components/ui/SidebarNav";
import { SidebarTabs, type SidebarTabItem } from "../components/ui/SidebarTabs";
import { StatCard } from "../components/ui/StatCard";
import { StatusPill } from "../components/ui/StatusPill";
import { Toggle } from "../components/ui/Toggle";
import type {
  AttemptScore,
  ExerciseCategory,
  ExerciseId,
  ExerciseProgressSummary,
  LessonStatus,
  NoteAssessmentStatus,
  TargetNote,
  ThemePreference
} from "../domain/contracts";
import { isExerciseId } from "../domain/exercise";
import { midiToNoteName } from "../domain/music";
import { SongPracticeScreen } from "../song/SongPracticeScreen";
import type { SongModeServices } from "../song/types";
import { PRESET_THEMES, type PitchCoachTheme } from "../themes";
import { usePitchCoachTheme } from "./theme";
import { usePitchCoachController, type PitchCoachControllerOptions } from "./usePitchCoachController";

export type PitchCoachAppProps = PitchCoachControllerOptions & {
  songServices?: SongModeServices;
};

const APP_BASE_PATH = normalizeBasePath(import.meta.env.BASE_URL);

export function PitchCoachApp(props: PitchCoachAppProps) {
  const router = usePitchCoachRouter();

  if (router.route.screen === "songs") {
    return (
      <SongPracticeScreen
        services={props.songServices}
        onBackToLibrary={() => router.goBackToLibraryFallback()}
      />
    );
  }

  const { songServices: _songServices, ...coachOptions } = props;
  return <ExercisePracticeApp router={router} coachOptions={coachOptions} />;
}

type ExercisePracticeAppProps = {
  router: ReturnType<typeof usePitchCoachRouter>;
  coachOptions: PitchCoachControllerOptions;
};

function ExercisePracticeApp({ router, coachOptions }: ExercisePracticeAppProps) {
  const coach = usePitchCoachController({
    ...coachOptions,
    initialExerciseId: router.route.screen === "practice" ? router.route.exerciseId : undefined
  });
  const activeTheme = usePitchCoachTheme(coach.settings.themePreference);

  useEffect(() => {
    if (
      router.route.screen === "practice" &&
      router.route.exerciseId !== coach.selectedExercise.id
    ) {
      coach.selectExercise(router.route.exerciseId);
    }
  }, [coach.selectedExercise.id, coach.selectExercise, router.route]);

  useEffect(() => {
    if (router.route.screen !== "practice") {
      void coach.stopAttempt();
    }
  }, [coach.stopAttempt, router.route.screen]);

  const openExercise = (exerciseId: (typeof coach.exercises)[number]["id"]) => {
    if (router.route.screen === "practice" && exerciseId === coach.selectedExercise.id) {
      return;
    }

    coach.selectExercise(exerciseId);
    router.navigateToExercise(exerciseId, {
      replace: router.route.screen === "practice",
      fromAppNavigation:
        router.route.screen === "practice" ? router.route.fromAppNavigation : true
    });
  };

  const backToLibrary = async () => {
    await coach.stopAttempt();
    router.goBackToLibraryFallback();
  };

  if (router.route.screen !== "practice") {
    return (
      <MainShell
        activeScreen={router.route.screen}
        settingsThemePreference={coach.settings.themePreference}
        onThemeChange={(themePreference) =>
          coach.setSettings({
            ...coach.settings,
            themePreference
          })
        }
        onNavigate={(screen) => {
          if (screen === "home") {
            router.navigateToHome();
            return;
          }
          if (screen === "library") {
            router.navigateToLibrary();
            return;
          }
          if (screen === "songs") {
            router.navigateToSongs();
            return;
          }
          router.navigateToProgress();
        }}
      >
        {router.route.screen === "home" ? (
          <HomeScreen
            exercises={coach.exercises}
            selectedExerciseId={coach.selectedExercise.id}
            exerciseProgress={coach.exerciseProgress}
            practiceSummary={coach.practiceSummary}
            recommendedExercise={coach.recommendedExercise}
            onSelectExercise={openExercise}
            onNavigateToPractice={() => router.navigateToLibrary()}
            onNavigateToSongs={() => router.navigateToSongs()}
            disabled={coach.isBusy}
          />
        ) : router.route.screen === "library" ? (
          <PracticeLibraryScreen
            exercises={coach.exercises}
            selectedExerciseId={coach.selectedExercise.id}
            exerciseProgress={coach.exerciseProgress}
            onSelectExercise={openExercise}
            disabled={coach.isBusy}
          />
        ) : (
          <ProgressScreen
            exercises={coach.exercises}
            exerciseProgress={coach.exerciseProgress}
            practiceSummary={coach.practiceSummary}
            recentAttempts={coach.recentAttempts}
          />
        )}
      </MainShell>
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
  const exerciseOptions = coach.exercises.map((exercise) => ({
    value: exercise.id,
    label: exercise.title
  })) satisfies DropdownOption<(typeof coach.exercises)[number]["id"]>[];
  const noteOptions = coach.noteOptions.map((note) => ({
    value: note.midi,
    label: note.label
  })) satisfies DropdownOption<number>[];
  const practiceStatusView = createPracticeStatusView(coach.lessonState.status, coach.attemptScore);
  const coachGuidance = createCoachGuidance({
    status: coach.lessonState.status,
    exerciseTitle: coach.selectedExercise.title,
    targetNotes: coach.targetNotes,
    attemptScore: coach.attemptScore
  });

  return (
    <main className="app-shell">
      <section className="coach-workspace" aria-label="Pitch coach exercise">
        <header className="top-bar">
          <div className="brand-lockup">
            <IconButton
              className="back-action"
              size="sm"
              onClick={() => void backToLibrary()}
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
                  onValueChange={openExercise}
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

            <div className="practice-guidance" aria-label="Practice guidance">
              <CoachBubble tone={coachGuidance.tone} icon={coachGuidance.icon}>
                <strong>{coachGuidance.title}</strong>
                <span>{coachGuidance.message}</span>
              </CoachBubble>
              <div className="practice-status-stack">
                <StatusPill tone={practiceStatusView.tone} pulse={practiceStatusView.pulse}>
                  {practiceStatusView.label}
                </StatusPill>
                <span>{practiceStatusView.detail}</span>
              </div>
            </div>

            <NoteCheckpointStrip
              targetNotes={coach.targetNotes}
              attemptScore={coach.attemptScore}
            />

            <PitchTimeline
              frames={coach.pitchFrames}
              targetNotes={coach.targetNotes}
              attemptScore={coach.attemptScore}
              totalDurationMs={coach.listeningDurationMs}
              toleranceCents={coach.settings.toleranceCents}
              status={coach.lessonState.status}
              themeName={activeTheme.name}
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

type PracticeStatusView = {
  label: string;
  detail: string;
  tone: "idle" | "active" | "success" | "warning" | "danger" | "info";
  pulse?: boolean;
};

type CoachGuidanceView = {
  title: string;
  message: string;
  tone: "accent" | "success" | "warning" | "info";
  icon: ReactNode;
};

function createPracticeStatusView(
  status: LessonStatus,
  attemptScore: AttemptScore | null
): PracticeStatusView {
  switch (status) {
    case "idle":
      return {
        label: "Ready",
        detail: "Guide starts when you press Start.",
        tone: "idle"
      };
    case "promptPlaying":
      return {
        label: "Listen",
        detail: "The reference is playing.",
        tone: "active",
        pulse: true
      };
    case "awaitingVoice":
      return {
        label: "Get ready",
        detail: "Sing when you are set.",
        tone: "active",
        pulse: true
      };
    case "listening":
      return {
        label: "Sing now",
        detail: "Pitch is being tracked locally.",
        tone: "active",
        pulse: true
      };
    case "scoring":
      return {
        label: "Scoring",
        detail: "Checking center, timing, and stability.",
        tone: "info",
        pulse: true
      };
    case "passed":
      return {
        label: "Passed",
        detail: "Moving to the next key.",
        tone: "success"
      };
    case "retry":
      return {
        label: "Retry",
        detail: attemptScore?.summary ?? "Review the notes and try again.",
        tone: "warning"
      };
    case "complete":
      return {
        label: "Complete",
        detail: "Range loop finished.",
        tone: "success"
      };
  }
}

function createCoachGuidance({
  status,
  exerciseTitle,
  targetNotes,
  attemptScore
}: {
  status: LessonStatus;
  exerciseTitle: string;
  targetNotes: TargetNote[];
  attemptScore: AttemptScore | null;
}): CoachGuidanceView {
  const notePattern = targetNotes.map((note) => midiToNoteName(note.midi)).join(" - ");

  switch (status) {
    case "idle":
      return {
        title: exerciseTitle,
        message: `Listen to the guide, then sing ${notePattern}.`,
        tone: "accent",
        icon: <Music2 size={18} />
      };
    case "promptPlaying":
      return {
        title: "Listen first",
        message: "Let the guide set the pitch center before you answer.",
        tone: "info",
        icon: <Volume2 size={18} />
      };
    case "awaitingVoice":
      return {
        title: "Your turn",
        message: "Start the pattern when you are ready; timing begins on your first clear pitch.",
        tone: "accent",
        icon: <Mic2 size={18} />
      };
    case "listening":
      return {
        title: "Keep it steady",
        message: "Aim for clean centers and smooth motion between notes.",
        tone: "accent",
        icon: <Activity size={18} />
      };
    case "scoring":
      return {
        title: "Checking your take",
        message: "Pitch centers, stability, and missed notes are being scored locally.",
        tone: "info",
        icon: <Gauge size={18} />
      };
    case "passed":
      return {
        title: "Nice pass",
        message: "That attempt is logged locally. The next key is queued.",
        tone: "success",
        icon: <CheckCircle2 size={18} />
      };
    case "retry":
      return {
        title: "One more pass",
        message: attemptScore?.summary ?? "Use the note checkpoints to choose what to adjust.",
        tone: "warning",
        icon: <RotateCcw size={18} />
      };
    case "complete":
      return {
        title: "Lesson complete",
        message: "Reset the lesson or choose another drill when you are ready.",
        tone: "success",
        icon: <CheckCircle2 size={18} />
      };
  }
}

function NoteCheckpointStrip({
  targetNotes,
  attemptScore
}: {
  targetNotes: TargetNote[];
  attemptScore: AttemptScore | null;
}) {
  const notes = attemptScore?.notes ?? targetNotes.map((note) => ({ ...note, score: null }));

  return (
    <ol className="note-checkpoint-strip" aria-label="Target notes">
      {notes.map((note, index) => {
        const status = note.score?.status ?? "target";
        return (
          <li
            key={`${index}-${note.degree}-${note.midi}`}
            className={`note-checkpoint note-checkpoint--${status}`}
          >
            <span className="note-checkpoint__degree">{note.degree}</span>
            <strong>{note.label}</strong>
            <span>{describeCheckpointStatus(status)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function describeCheckpointStatus(status: NoteAssessmentStatus | "target") {
  switch (status) {
    case "target":
      return "Target";
    case "pass":
      return "Pass";
    case "passWithWarning":
      return "Watch";
    case "flat":
      return "Flat";
    case "sharp":
      return "Sharp";
    case "wrongNote":
      return "Wrong";
    case "unstable":
      return "Unstable";
    case "unclear":
      return "Unclear";
    case "missed":
      return "Missed";
  }
}

type TopLevelScreen = "home" | "library" | "songs" | "progress";

const navigationItems = [
  { value: "home", label: "Home", icon: <Home size={19} /> },
  { value: "library", label: "Practice", icon: <Target size={19} /> },
  { value: "songs", label: "Sing", icon: <Music2 size={19} /> },
  { value: "progress", label: "Progress", icon: <TrendingUp size={19} /> }
] satisfies SidebarTabItem<TopLevelScreen>[];

function MainShell({
  activeScreen,
  settingsThemePreference,
  onThemeChange,
  onNavigate,
  children
}: {
  activeScreen: TopLevelScreen;
  settingsThemePreference: ThemePreference;
  onThemeChange: (themePreference: ThemePreference) => void;
  onNavigate: (screen: TopLevelScreen) => void;
  children: ReactNode;
}) {
  return (
    <AppShell
      className="pitch-shell"
      sidebar={
        <SidebarNav
          brand={<PitchCoachBrand />}
          items={navigationItems}
          activeValue={activeScreen}
          onNavigate={onNavigate}
          footer={<LocalSaveFooter />}
        />
      }
      header={
        <div className="shell-topbar">
          <div className="shell-topbar__copy">
            <span className="readout-label">Pitch Coach</span>
            <strong>{screenTitle[activeScreen]}</strong>
          </div>
          <ThemePicker value={settingsThemePreference} onValueChange={onThemeChange} />
        </div>
      }
    >
      {children}
    </AppShell>
  );
}

const screenTitle = {
  home: "Home",
  library: "Practice Library",
  songs: "Sing",
  progress: "Progress"
} as const;

function PitchCoachBrand() {
  return (
    <div className="shell-brand">
      <span className="shell-brand__mark" aria-hidden="true">
        <Target size={19} />
      </span>
      <span className="shell-brand__name">Pitch Coach</span>
    </div>
  );
}

function LocalSaveFooter() {
  return (
    <div className="shell-local-save">
      <span className="shell-local-save__mark" aria-hidden="true">
        <Mic2 size={17} />
      </span>
      <span>
        <strong>Local practice</strong>
        <span>Saved on this device</span>
      </span>
    </div>
  );
}

type LibraryScreenProps = {
  exercises: ReturnType<typeof usePitchCoachController>["exercises"];
  selectedExerciseId: ReturnType<typeof usePitchCoachController>["selectedExercise"]["id"];
  exerciseProgress: ReturnType<typeof usePitchCoachController>["exerciseProgress"];
  onSelectExercise: (exerciseId: ReturnType<typeof usePitchCoachController>["selectedExercise"]["id"]) => void;
  disabled: boolean;
};

type HomeScreenProps = LibraryScreenProps & {
  practiceSummary: ReturnType<typeof usePitchCoachController>["practiceSummary"];
  recommendedExercise: ReturnType<typeof usePitchCoachController>["recommendedExercise"];
  onNavigateToPractice: () => void;
  onNavigateToSongs: () => void;
};

function HomeScreen({
  exercises,
  selectedExerciseId,
  exerciseProgress,
  practiceSummary,
  recommendedExercise,
  onSelectExercise,
  onNavigateToPractice,
  onNavigateToSongs,
  disabled
}: HomeScreenProps) {
  const recommendedProgress = exerciseProgress[recommendedExercise.exercise.id];

  return (
    <main className="shell-page shell-page--home" aria-label="Pitch coach home">
      <PageHeader
        icon={<Target size={24} />}
        title="Pitch Coach"
        description="Choose a guided drill, sing after the prompt, and keep every practice stat local to this browser."
        actions={
          <>
            <Button variant="primary" size="md" onClick={onNavigateToPractice}>
              <Target size={16} />
              <span>Practice Library</span>
            </Button>
            <Button className="mode-action" variant="song" size="md" onClick={onNavigateToSongs}>
              <Music2 size={16} />
              <span>Song mode</span>
            </Button>
          </>
        }
      />
      <section className="home-summary-grid" aria-label="Practice summary">
        <StatCard
          tone="accent"
          icon={<CalendarDays size={16} />}
          label="Day streak"
          value={practiceSummary.streakDays}
          detail={
            practiceSummary.lastPracticedAt
              ? formatLastPracticed(practiceSummary.lastPracticedAt)
              : "No local attempts yet"
          }
        />
        <StatCard
          tone="success"
          icon={<Activity size={16} />}
          label="Recent pass"
          value={practiceSummary.recentPassRate ?? 0}
          unit="%"
          detail={formatAttemptRatio(practiceSummary.passedAttemptCount, practiceSummary.attemptCount)}
        />
        <StatCard
          icon={<CheckCircle2 size={16} />}
          label="Notes in tune"
          value={practiceSummary.noteAccuracy ?? 0}
          unit="%"
          detail={formatNoteRatio(practiceSummary.notesInTune, practiceSummary.noteCount)}
        />
        <StatCard
          tone="song"
          icon={<Clock3 size={16} />}
          label="Practice time"
          value={practiceSummary.practiceMinutes}
          unit="min"
          detail={formatWeekAttemptCount(practiceSummary.weekActivity)}
        />
      </section>
      <section className="home-spotlight-grid" aria-label="Practice shortcuts">
        <Card className="home-recommendation-card" tone="accent" padding="lg">
          <CardHeader>
            <div className="home-card-kicker">
              <Chip tone="accent" size="sm">
                <Sparkles size={13} />
                Recommended
              </Chip>
              <Chip tone="neutral" size="sm">
                {formatCategoryLabel(recommendedExercise.exercise.category)}
              </Chip>
            </div>
            <CardTitle>{recommendedExercise.exercise.title}</CardTitle>
            <CardDescription>{recommendedExercise.reason}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="home-recommendation-meta">
              <span>{recommendedExercise.exercise.focus}</span>
              <span>{recommendedExercise.exercise.defaultTempoBpm} bpm</span>
              <span>{formatProgressSummary(recommendedProgress)}</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              variant="primary"
              size="md"
              onClick={() => onSelectExercise(recommendedExercise.exercise.id)}
              disabled={disabled}
            >
              <Play size={16} />
              <span>Start recommended drill</span>
            </Button>
          </CardFooter>
        </Card>
        <Card className="home-week-card" variant="subtle" padding="lg">
          <CardHeader>
            <CardTitle>Last 7 Days</CardTitle>
            <CardDescription>Attempt volume from local practice history.</CardDescription>
          </CardHeader>
          <CardContent>
            <WeekActivityStrip buckets={practiceSummary.weekActivity} />
          </CardContent>
        </Card>
      </section>
      <div className="home-mode-grid">
        <Card variant="interactive" tone="accent" onClick={onNavigateToPractice}>
          <CardHeader>
            <Chip tone="accent" size="sm">
              <Target size={13} />
              Practice
            </Chip>
            <CardTitle>Interval training</CardTitle>
            <CardDescription>Guided pitch drills for ear and voice.</CardDescription>
          </CardHeader>
        </Card>
        <Card variant="interactive" tone="song" onClick={onNavigateToSongs}>
          <CardHeader>
            <Chip tone="song" size="sm">
              <Music2 size={13} />
              Sing
            </Chip>
            <CardTitle>Sing a song</CardTitle>
            <CardDescription>Upload a local track and practice against the real vocal contour.</CardDescription>
          </CardHeader>
        </Card>
      </div>
      <ExerciseLibrary
        exercises={exercises}
        selectedExerciseId={selectedExerciseId}
        exerciseProgress={exerciseProgress}
        onSelectExercise={onSelectExercise}
        disabled={disabled}
      />
    </main>
  );
}

function PracticeLibraryScreen(props: LibraryScreenProps) {
  return (
    <main className="shell-page" aria-label="Pitch coach exercises">
      <PageHeader
        icon={<Target size={24} />}
        eyebrow="Exercises"
        title="Practice Library"
        description="Pick a focused drill and keep the feedback loop moving."
      />
      <ExerciseLibrary {...props} />
    </main>
  );
}

type ProgressScreenProps = {
  exercises: ReturnType<typeof usePitchCoachController>["exercises"];
  exerciseProgress: ReturnType<typeof usePitchCoachController>["exerciseProgress"];
  practiceSummary: ReturnType<typeof usePitchCoachController>["practiceSummary"];
  recentAttempts: ReturnType<typeof usePitchCoachController>["recentAttempts"];
};

function ProgressScreen({
  exercises,
  exerciseProgress,
  practiceSummary,
  recentAttempts
}: ProgressScreenProps) {
  const hasHistory = practiceSummary.attemptCount > 0;

  return (
    <main className="shell-page" aria-label="Pitch coach progress">
      <PageHeader
        icon={<TrendingUp size={24} />}
        eyebrow="Local stats"
        title="Your Progress"
        description="Review attempts, note accuracy, weekly activity, and drill progress saved on this device."
      />
      <section className="home-summary-grid progress-summary-grid" aria-label="Progress summary">
        <StatCard
          tone="accent"
          icon={<CalendarDays size={16} />}
          label="Day streak"
          value={practiceSummary.streakDays}
          detail={
            practiceSummary.lastPracticedAt
              ? formatLastPracticed(practiceSummary.lastPracticedAt)
              : "No local attempts yet"
          }
        />
        <StatCard
          tone="success"
          icon={<Activity size={16} />}
          label="Recent pass"
          value={practiceSummary.recentPassRate ?? 0}
          unit="%"
          detail={formatAttemptRatio(practiceSummary.passedAttemptCount, practiceSummary.attemptCount)}
        />
        <StatCard
          icon={<CheckCircle2 size={16} />}
          label="Notes in tune"
          value={practiceSummary.noteAccuracy ?? 0}
          unit="%"
          detail={formatNoteRatio(practiceSummary.notesInTune, practiceSummary.noteCount)}
        />
        <StatCard
          tone="song"
          icon={<Clock3 size={16} />}
          label="Practice time"
          value={practiceSummary.practiceMinutes}
          unit="min"
          detail={formatWeekAttemptCount(practiceSummary.weekActivity)}
        />
      </section>
      {!hasHistory ? (
        <Card variant="subtle" padding="lg">
          <CardHeader>
            <CardTitle>No attempts yet</CardTitle>
            <CardDescription>
              Complete a guided exercise and your local progress dashboard will fill in here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <section className="progress-dashboard-grid">
          <Card className="progress-week-card" padding="lg">
            <CardHeader>
              <CardTitle>Last 7 Days</CardTitle>
              <CardDescription>Attempts saved in this browser.</CardDescription>
            </CardHeader>
            <CardContent>
              <WeekActivityStrip buckets={practiceSummary.weekActivity} />
            </CardContent>
          </Card>

          <Card className="progress-exercises-card" padding="lg">
            <CardHeader>
              <CardTitle>Exercise Progress</CardTitle>
              <CardDescription>Recent pass rate and common issue by drill.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="progress-exercise-list">
                {exercises.map((exercise) => {
                  const progress = exerciseProgress[exercise.id];
                  return (
                    <li key={exercise.id}>
                      <span>
                        <strong>{exercise.title}</strong>
                        <span>{formatCategoryLabel(exercise.category)}</span>
                      </span>
                      <span>
                        {progress.recentPassRate === undefined
                          ? "No attempts"
                          : `${progress.recentPassRate}% pass`}
                      </span>
                      <span>
                        {progress.commonIssue
                          ? `Issue: ${describeIssue(progress.commonIssue)}`
                          : formatLastPracticed(progress.lastPracticedAt)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          <Card className="progress-sessions-card" padding="lg">
            <CardHeader>
              <CardTitle>Recent Sessions</CardTitle>
              <CardDescription>Newest local attempts across all exercises.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="progress-session-list">
                {recentAttempts.map((attempt) => (
                  <li key={attempt.id}>
                    <span className={`history-result ${attempt.passed ? "history-pass" : "history-fail"}`}>
                      {attempt.passed ? "Pass" : "Retry"}
                    </span>
                    <span className="history-copy">
                      <strong>
                        {getExerciseTitle(exercises, attempt.exerciseId)} · {midiToNoteName(attempt.rootMidi)} major
                      </strong>
                      <span>{formatHistoryDate(attempt.createdAt)}</span>
                      <span>{attempt.summary}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </section>
      )}
    </main>
  );
}

type ThemePickerOption = {
  key: string;
  label: string;
  preference: ThemePreference;
  icon: typeof Monitor;
  theme?: PitchCoachTheme;
};

const themeOptions: ThemePickerOption[] = [
  {
    key: "system",
    label: "System",
    preference: {
      mode: "system"
    },
    icon: Monitor
  },
  ...PRESET_THEMES.map(
    (theme): ThemePickerOption => ({
      key: `theme:${theme.name}`,
      label: theme.name,
      preference: {
        mode: "theme",
        themeName: theme.name
      },
      icon: theme.type === "light" ? Sun : Moon,
      theme
    })
  )
];

function ThemePicker({
  value,
  onValueChange
}: {
  value: ThemePreference;
  onValueChange: (themePreference: ThemePreference) => void;
}) {
  const selectedKey = themePreferenceKey(value);

  return (
    <div className="theme-picker" role="radiogroup" aria-label="Theme">
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const isSelected = selectedKey === option.key;
        return (
          <button
            key={option.key}
            className={`theme-option${isSelected ? " theme-option-active" : ""}`}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${option.label} theme`}
            title={`${option.label} theme`}
            onClick={() => onValueChange(option.preference)}
          >
            {option.theme ? (
              <span className="theme-option__swatches" aria-hidden="true">
                <span style={{ background: option.theme.colors["bg.primary"] }} />
                <span style={{ background: option.theme.colors["bg.secondary"] }} />
                <span style={{ background: option.theme.colors["accent.primary"] }} />
              </span>
            ) : (
              <Icon size={14} />
            )}
            <span className="theme-option__label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function themePreferenceKey(themePreference: ThemePreference) {
  return themePreference.mode === "system" ? "system" : `theme:${themePreference.themeName}`;
}

function formatClipDuration(durationMs: number) {
  return `${Math.max(0, durationMs / 1000).toFixed(1)}s`;
}

type AppRoute =
  | {
      screen: "home";
      fromAppNavigation: boolean;
    }
  | {
      screen: "library";
      fromAppNavigation: boolean;
    }
  | {
      screen: "practice";
      exerciseId: ExerciseId;
      fromAppNavigation: boolean;
    }
  | {
      screen: "songs";
      fromAppNavigation: boolean;
    }
  | {
      screen: "progress";
      fromAppNavigation: boolean;
    };

type RouteLocation =
  | {
      screen: "home";
    }
  | {
      screen: "library";
    }
  | {
      screen: "practice";
      exerciseId: ExerciseId;
    }
  | {
      screen: "songs";
    }
  | {
      screen: "progress";
    };

type ParsedRoute = {
  route: RouteLocation;
  invalid: boolean;
};

type PitchCoachHistoryState = {
  pitchCoach?: {
    fromAppNavigation: boolean;
  };
};

function usePitchCoachRouter() {
  const [route, setRoute] = useState<AppRoute>(() => readCurrentRoute());

  useEffect(() => {
    const syncRoute = () => {
      const parsed = parsePathname(window.location.pathname);
      if (parsed.invalid) {
        window.history.replaceState(createHistoryState(false), "", routePath({ screen: "home" }));
        setRoute({
          screen: "home",
          fromAppNavigation: false
        });
        return;
      }

      if (!isPitchCoachHistoryState(window.history.state)) {
        window.history.replaceState(
          createHistoryState(false),
          "",
          routePath(parsed.route)
        );
      }

      setRoute(readCurrentRoute());
    };

    syncRoute();
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  const navigateToHome = useCallback((options: { replace?: boolean } = {}) => {
    const nextRoute = {
      screen: "home" as const,
      fromAppNavigation: true
    };
    const state = createHistoryState(true);
    if (options.replace) {
      window.history.replaceState(state, "", routePath({ screen: "home" }));
    } else {
      window.history.pushState(state, "", routePath({ screen: "home" }));
    }
    setRoute(nextRoute);
  }, []);

  const navigateToLibrary = useCallback((options: { replace?: boolean } = {}) => {
    const nextRoute = {
      screen: "library" as const,
      fromAppNavigation: true
    };
    const state = createHistoryState(true);
    if (options.replace) {
      window.history.replaceState(state, "", routePath({ screen: "library" }));
    } else {
      window.history.pushState(state, "", routePath({ screen: "library" }));
    }
    setRoute(nextRoute);
  }, []);

  const navigateToExercise = useCallback(
    (exerciseId: ExerciseId, options: { replace?: boolean; fromAppNavigation?: boolean } = {}) => {
      const nextRoute = {
        screen: "practice" as const,
        exerciseId,
        fromAppNavigation: options.fromAppNavigation ?? true
      };
      const state = createHistoryState(nextRoute.fromAppNavigation);
      const path = routePath({ screen: "practice", exerciseId });
      if (options.replace) {
        window.history.replaceState(state, "", path);
      } else {
        window.history.pushState(state, "", path);
      }
      setRoute(nextRoute);
    },
    []
  );

  const navigateToSongs = useCallback((options: { replace?: boolean } = {}) => {
    const nextRoute = {
      screen: "songs" as const,
      fromAppNavigation: true
    };
    const state = createHistoryState(true);
    if (options.replace) {
      window.history.replaceState(state, "", routePath({ screen: "songs" }));
    } else {
      window.history.pushState(state, "", routePath({ screen: "songs" }));
    }
    setRoute(nextRoute);
  }, []);

  const navigateToProgress = useCallback((options: { replace?: boolean } = {}) => {
    const nextRoute = {
      screen: "progress" as const,
      fromAppNavigation: true
    };
    const state = createHistoryState(true);
    if (options.replace) {
      window.history.replaceState(state, "", routePath({ screen: "progress" }));
    } else {
      window.history.pushState(state, "", routePath({ screen: "progress" }));
    }
    setRoute(nextRoute);
  }, []);

  const goBackToLibraryFallback = useCallback(() => {
    if ((route.screen === "practice" || route.screen === "songs") && route.fromAppNavigation) {
      window.history.back();
      return;
    }

    navigateToLibrary({ replace: true });
  }, [navigateToLibrary, route]);

  return {
    route,
    navigateToHome,
    navigateToLibrary,
    navigateToExercise,
    navigateToSongs,
    navigateToProgress,
    goBackToLibraryFallback
  };
}

function readCurrentRoute(): AppRoute {
  const parsed = parsePathname(window.location.pathname);
  if (parsed.invalid) {
    return {
      screen: "home",
      fromAppNavigation: false
    };
  }

  return {
    ...parsed.route,
    fromAppNavigation: isPitchCoachHistoryState(window.history.state)
      ? window.history.state.pitchCoach.fromAppNavigation
      : false
  };
}

function parsePathname(pathname: string): ParsedRoute {
  const appPathname = stripAppBase(pathname);

  if (appPathname === "/" || appPathname === "") {
    return {
      route: { screen: "home" },
      invalid: false
    };
  }

  if (appPathname === "/practice" || appPathname === "/practice/") {
    return {
      route: { screen: "library" },
      invalid: false
    };
  }

  if (appPathname === "/songs" || appPathname === "/songs/") {
    return {
      route: { screen: "songs" },
      invalid: false
    };
  }

  if (appPathname === "/sing" || appPathname === "/sing/") {
    return {
      route: { screen: "songs" },
      invalid: false
    };
  }

  if (appPathname === "/progress" || appPathname === "/progress/") {
    return {
      route: { screen: "progress" },
      invalid: false
    };
  }

  const exerciseMatch = appPathname.match(/^\/exercises\/([^/]+)\/?$/);
  if (!exerciseMatch) {
    return {
      route: { screen: "home" },
      invalid: true
    };
  }

  let exerciseId: string;
  try {
    exerciseId = decodeURIComponent(exerciseMatch[1]);
  } catch {
    return {
      route: { screen: "home" },
      invalid: true
    };
  }

  if (!isExerciseId(exerciseId)) {
    return {
      route: { screen: "home" },
      invalid: true
    };
  }

  return {
    route: {
      screen: "practice",
      exerciseId
    },
    invalid: false
  };
}

function routePath(route: RouteLocation) {
  const pathname =
    route.screen === "home"
      ? "/"
      : route.screen === "library"
        ? "/practice"
        : route.screen === "songs"
          ? "/songs"
          : route.screen === "progress"
            ? "/progress"
            : `/exercises/${route.exerciseId}`;
  return withAppBase(pathname);
}

function createHistoryState(fromAppNavigation: boolean): PitchCoachHistoryState {
  return {
    pitchCoach: {
      fromAppNavigation
    }
  };
}

function isPitchCoachHistoryState(value: unknown): value is Required<PitchCoachHistoryState> {
  return (
    typeof value === "object" &&
    value !== null &&
    "pitchCoach" in value &&
    typeof (value as PitchCoachHistoryState).pitchCoach?.fromAppNavigation === "boolean"
  );
}

function normalizeBasePath(baseUrl: string) {
  const pathname = new URL(baseUrl, "https://pitch-coach.local").pathname;
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function stripAppBase(pathname: string) {
  if (APP_BASE_PATH === "/") {
    return pathname || "/";
  }

  const baseWithoutTrailingSlash = APP_BASE_PATH.replace(/\/$/, "");
  if (pathname === baseWithoutTrailingSlash) {
    return "/";
  }

  if (pathname.startsWith(`${baseWithoutTrailingSlash}/`)) {
    return pathname.slice(baseWithoutTrailingSlash.length) || "/";
  }

  return pathname;
}

function withAppBase(pathname: string) {
  if (APP_BASE_PATH === "/") {
    return pathname;
  }

  if (pathname === "/" || pathname === "") {
    return APP_BASE_PATH;
  }

  return `${APP_BASE_PATH.replace(/\/$/, "")}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

type ExerciseLibraryProps = {
  exercises: ReturnType<typeof usePitchCoachController>["exercises"];
  selectedExerciseId: ReturnType<typeof usePitchCoachController>["selectedExercise"]["id"];
  exerciseProgress: ReturnType<typeof usePitchCoachController>["exerciseProgress"];
  onSelectExercise: (exerciseId: ReturnType<typeof usePitchCoachController>["selectedExercise"]["id"]) => void;
  disabled: boolean;
};

type ExerciseCategoryFilter = "all" | ExerciseCategory;

const exerciseCategoryFilters: readonly ExerciseCategoryFilter[] = [
  "all",
  "pitch",
  "interval",
  "arpeggio",
  "scale"
];

function ExerciseLibrary({
  exercises,
  selectedExerciseId,
  exerciseProgress,
  onSelectExercise,
  disabled
}: ExerciseLibraryProps) {
  const [activeCategory, setActiveCategory] = useState<ExerciseCategoryFilter>("all");
  const categoryItems = useMemo(
    () =>
      exerciseCategoryFilters.map((category): SidebarTabItem<ExerciseCategoryFilter> => {
        const count =
          category === "all"
            ? exercises.length
            : exercises.filter((exercise) => exercise.category === category).length;
        return {
          value: category,
          label: formatCategoryLabel(category),
          icon: category === "all" ? <Layers3 size={15} /> : categoryIcon(category),
          meta: count
        };
      }),
    [exercises]
  );
  const visibleExercises = useMemo(
    () =>
      activeCategory === "all"
        ? exercises
        : exercises.filter((exercise) => exercise.category === activeCategory),
    [activeCategory, exercises]
  );
  const groupedExercises = useMemo(
    () =>
      exerciseCategoryFilters
        .filter((category): category is ExerciseCategory => category !== "all")
        .map((category) => ({
          category,
          exercises: visibleExercises.filter((exercise) => exercise.category === category)
        }))
        .filter((group) => group.exercises.length > 0),
    [visibleExercises]
  );

  return (
    <section className="exercise-library" aria-label="Exercise library">
      <div className="library-heading">
        <div>
          <span className="readout-label">Exercises</span>
          <h2>Practice Library</h2>
        </div>
        <span>
          {visibleExercises.length} of {exercises.length} drills
        </span>
      </div>
      <div className="library-filters">
        <SidebarTabs
          value={activeCategory}
          items={categoryItems}
          onValueChange={setActiveCategory}
          ariaLabel="Exercise categories"
          orientation="horizontal"
          className="library-filter-tabs"
        />
      </div>
      <div className="exercise-groups">
        {groupedExercises.map((group) => (
          <section
            key={group.category}
            className="exercise-group"
            aria-labelledby={`exercise-group-${group.category}`}
          >
            <div className="exercise-group__header">
              <h3 id={`exercise-group-${group.category}`}>{formatCategoryLabel(group.category)}</h3>
              <span>{group.exercises.length} drills</span>
            </div>
            <div className="exercise-list">
              {group.exercises.map((exercise) => {
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
                    <span
                      className="difficulty-meter"
                      aria-label={`Difficulty ${exercise.difficulty} of 5`}
                    >
                      {Array.from({ length: 5 }, (_, index) => (
                        <span
                          key={index}
                          className={index < exercise.difficulty ? "difficulty-on" : ""}
                        />
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
                      <span>{midiToNoteName(exercise.startRootMidi)} start</span>
                      <span>{exercise.defaultTempoBpm} bpm</span>
                    </span>
                    <span className="exercise-start">Start</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function WeekActivityStrip({
  buckets
}: {
  buckets: ReturnType<typeof usePitchCoachController>["practiceSummary"]["weekActivity"];
}) {
  const maxAttemptCount = Math.max(1, ...buckets.map((bucket) => bucket.attemptCount));

  return (
    <div className="week-activity-strip" aria-label="Last seven days of attempts">
      {buckets.map((bucket) => {
        const height = bucket.attemptCount === 0 ? 8 : 8 + (bucket.attemptCount / maxAttemptCount) * 42;
        return (
          <span key={bucket.date} className="week-activity-strip__day">
            <span
              className="week-activity-strip__bar"
              style={{ height }}
              title={`${formatWeekday(bucket.date)}: ${bucket.attemptCount} attempts`}
            />
            <span>{formatWeekday(bucket.date)}</span>
          </span>
        );
      })}
    </div>
  );
}

function formatExercisePatternText(patternDegrees: readonly number[]) {
  return patternDegrees.join("-");
}

function formatCategoryLabel(category: ExerciseCategoryFilter) {
  switch (category) {
    case "all":
      return "All";
    case "pitch":
      return "Pitch";
    case "interval":
      return "Intervals";
    case "arpeggio":
      return "Arpeggios";
    case "scale":
      return "Scales";
  }
}

function getExerciseTitle(
  exercises: ReturnType<typeof usePitchCoachController>["exercises"],
  exerciseId: ExerciseId
) {
  return exercises.find((exercise) => exercise.id === exerciseId)?.title ?? "Exercise";
}

function categoryIcon(category: ExerciseCategory) {
  switch (category) {
    case "pitch":
      return <Target size={15} />;
    case "interval":
      return <Activity size={15} />;
    case "arpeggio":
      return <TrendingUp size={15} />;
    case "scale":
      return <Gauge size={15} />;
  }
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

function formatAttemptRatio(passedAttemptCount: number, attemptCount: number) {
  if (attemptCount === 0) {
    return "No attempts yet";
  }

  return `${passedAttemptCount} of ${attemptCount} attempts passed`;
}

function formatNoteRatio(notesInTune: number, noteCount: number) {
  if (noteCount === 0) {
    return "No notes scored yet";
  }

  return `${notesInTune} of ${noteCount} notes in tune`;
}

function formatWeekAttemptCount(
  buckets: ReturnType<typeof usePitchCoachController>["practiceSummary"]["weekActivity"]
) {
  const attemptCount = buckets.reduce((total, bucket) => total + bucket.attemptCount, 0);
  if (attemptCount === 0) {
    return "No attempts this week";
  }

  return `${attemptCount} attempts this week`;
}

function formatWeekday(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString([], {
    weekday: "short"
  });
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
