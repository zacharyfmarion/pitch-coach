import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowUpRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Flame,
  Gauge,
  History,
  Home,
  LineChart,
  Mic,
  Music2,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Square,
  Target,
  Trash2,
  TrendingUp,
  Upload,
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
  CardHeader,
  CardTitle
} from "../components/ui/Card";
import { CoachBubble } from "../components/ui/CoachBubble";
import { IconButton } from "../components/ui/IconButton";
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
  ExerciseDefinition,
} from "../domain/contracts";
import { isExerciseId } from "../domain/exercise";
import { midiToNoteName } from "../domain/music";
import { SongPracticeScreen } from "../song/SongPracticeScreen";
import type { SongModeServices } from "../song/types";
import { usePitchCoachTheme } from "./theme";
import { usePitchCoachController, type PitchCoachControllerOptions } from "./usePitchCoachController";

export type PitchCoachAppProps = PitchCoachControllerOptions & {
  songServices?: SongModeServices;
};

const APP_BASE_PATH = normalizeBasePath(import.meta.env.BASE_URL);

export function PitchCoachApp(props: PitchCoachAppProps) {
  const router = usePitchCoachRouter();

  const { songServices, ...coachOptions } = props;
  return <ExercisePracticeApp router={router} coachOptions={coachOptions} songServices={songServices} />;
}

type ExercisePracticeAppProps = {
  router: ReturnType<typeof usePitchCoachRouter>;
  coachOptions: PitchCoachControllerOptions;
  songServices?: SongModeServices;
};

function ExercisePracticeApp({ router, coachOptions, songServices }: ExercisePracticeAppProps) {
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

  const navigateTopLevel = (screen: TopLevelScreen) => {
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
  };

  const backToLibrary = async () => {
    await coach.stopAttempt();
    router.goBackToLibraryFallback();
  };

  if (router.route.screen !== "practice") {
    return (
      <MainShell activeScreen={router.route.screen} onNavigate={navigateTopLevel}>
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
        ) : router.route.screen === "songs" ? (
          <SongPracticeScreen services={songServices} />
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
  const notesInTuneCount =
    coach.attemptScore?.notes.filter((note) =>
      note.score ? ["pass", "passWithWarning"].includes(note.score.status) : false
    ).length ?? 0;

  return (
    <MainShell activeScreen="library" onNavigate={navigateTopLevel}>
      <main className="practice-detail-page">
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
                <Mic size={22} />
              </div>
              <div className="brand-copy">
                <Dropdown
                  ariaLabel="Exercise"
                  value={coach.selectedExercise.id}
                  options={exerciseOptions}
                  onValueChange={openExercise}
                  disabled={coach.isBusy}
                  triggerClassName="practice-title-dropdown"
                />
                <p>Take {coach.lessonState.attemptNumber + 1}</p>
              </div>
            </div>
            <div className="top-actions">
              <div className="session-readout" aria-live="polite">
                <span className="readout-label">Key of</span>
                <strong>{coach.currentKeyLabel}</strong>
              </div>
            </div>
          </header>

          <section className="practice-layout">
            <div className="lesson-panel">
              <div className="practice-guidance" aria-label="Practice guidance">
                <CoachBubble tone={coachGuidance.tone} icon={coachGuidance.icon}>
                  <strong>{coachGuidance.title}</strong>
                  <span>{coachGuidance.message}</span>
                </CoachBubble>
                <div className="practice-status-stack">
                  <StatusPill tone={practiceStatusView.tone} pulse={practiceStatusView.pulse}>
                    {practiceStatusView.label}
                  </StatusPill>
                  <span className="practice-status-detail">{practiceStatusView.detail}</span>
                  <span className="practice-status-legacy">
                    {legacyStatusCopy[coach.lessonState.status]}
                  </span>
                </div>
              </div>

              <div className="practice-target-row">
                <NoteCheckpointStrip
                  targetNotes={coach.targetNotes}
                  attemptScore={coach.attemptScore}
                />
                <div className="practice-score-readout" aria-label={`${notesInTuneCount} notes in tune`}>
                  <strong>
                    {notesInTuneCount}
                    <span>/{coach.targetNotes.length}</span>
                  </strong>
                  <span>notes in tune</span>
                </div>
              </div>

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

            <aside className="side-panel practice-side-panel" aria-label="Lesson controls and feedback">
              <Card as="section" className="control-group" variant="mock" padding="md" aria-label="Range">
                <CardHeader className="group-heading">
                  <SlidersHorizontal size={17} />
                  <CardTitle>Range</CardTitle>
                </CardHeader>
                <CardContent className="control-group__body">
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
                </CardContent>
              </Card>

              <Card as="section" className="control-group" variant="mock" padding="md" aria-label="Scoring">
                <CardHeader className="group-heading">
                  <Gauge size={17} />
                  <CardTitle>Scoring</CardTitle>
                </CardHeader>
                <CardContent className="control-group__body">
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
                </CardContent>
              </Card>

              {coach.localClip || coach.clipErrorMessage ? (
                <Card
                  as="section"
                  className="control-group"
                  variant="mock"
                  padding="md"
                  aria-label="Latest local clip"
                >
                  <CardHeader className="group-heading">
                    <Volume2 size={17} />
                    <CardTitle>Latest Clip</CardTitle>
                  </CardHeader>
                  <CardContent className="control-group__body">
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
                  </CardContent>
                </Card>
              ) : null}

              <Card
                as="section"
                className="feedback-panel"
                variant="mock"
                padding="md"
                aria-label="Attempt feedback"
              >
                <CardHeader className="group-heading">
                  <Music2 size={17} />
                  <CardTitle>Feedback</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="coach-summary">
                    {coach.attemptScore?.summary ??
                      `Sing ${coach.targetNotes.map((note) => midiToNoteName(note.midi)).join(" - ")} after the guide.`}
                  </p>
                  <FeedbackList targetNotes={coach.targetNotes} attemptScore={coach.attemptScore} />
                </CardContent>
              </Card>

              <Card
                as="section"
                className="control-group history-panel"
                variant="mock"
                padding="md"
                aria-label="Attempt history"
              >
                <CardHeader className="group-heading">
                  <History size={17} />
                  <CardTitle>History</CardTitle>
                </CardHeader>
                <CardContent className="control-group__body">
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
                </CardContent>
              </Card>
            </aside>
          </section>
        </section>
      </main>
    </MainShell>
  );
}

type PracticeStatusView = {
  label: string;
  detail: string;
  tone: "idle" | "active" | "success" | "warning" | "danger" | "info";
  pulse?: boolean;
};

const legacyStatusCopy = {
  idle: "Ready",
  promptPlaying: "Prompt",
  awaitingVoice: "Waiting for voice",
  listening: "Listening",
  scoring: "Scoring",
  passed: "Passed",
  retry: "Retry",
  complete: "Complete"
} as const;

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
        icon: <Mic size={18} />
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
            <span className="note-checkpoint__label">{describeCheckpointLabel(note, status, index)}</span>
            <span className="checkpoint-status-legacy">{describeCheckpointStatus(status)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function describeCheckpointLabel(
  note: TargetNote,
  status: NoteAssessmentStatus | "target",
  index: number
) {
  if (status !== "target") {
    return describeCheckpointStatus(status);
  }

  switch (note.degree) {
    case 1:
      return "Root";
    case 2:
      return "Second";
    case 3:
      return "Third";
    case 4:
      return "Fourth";
    case 5:
      return "Fifth";
    case 8:
      return "Octave";
    default:
      return `Note ${index + 1}`;
  }
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
  { value: "songs", label: "Sing", icon: <Mic size={19} /> },
  { value: "progress", label: "Progress", icon: <TrendingUp size={19} /> }
] satisfies SidebarTabItem<TopLevelScreen>[];

function MainShell({
  activeScreen,
  onNavigate,
  children
}: {
  activeScreen: TopLevelScreen;
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
    >
      {children}
    </AppShell>
  );
}

function PitchCoachBrand() {
  return (
    <div className="shell-brand">
      <span className="shell-brand__mark" aria-hidden="true">
        <Target size={24} />
      </span>
      <span className="shell-brand__name">Pitch Coach</span>
    </div>
  );
}

function LocalSaveFooter() {
  return (
    <div className="shell-local-footer">
      <div className="shell-streak-card">
        <Flame size={22} aria-hidden="true" />
        <span>
          <strong>12 days</strong>
          <span>practice streak</span>
        </span>
      </div>
      <div className="shell-user-card">
        <span className="shell-user-avatar" aria-hidden="true">
          R
        </span>
        <span className="shell-user-copy">
          <strong>Robin</strong>
          <span>Saved on this device</span>
        </span>
        <span className="shell-user-sun" aria-hidden="true">
          <SunGlyph />
        </span>
      </div>
    </div>
  );
}

function SunGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
    </svg>
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
  onSelectExercise,
  onNavigateToPractice,
  onNavigateToSongs,
  disabled
}: HomeScreenProps) {
  return (
    <main className="mock-home" aria-label="Pitch coach home">
      <section className="mock-home__header">
        <div>
          <h1>Good evening, Robin</h1>
          <p>You’re on a 12-day roll — a few minutes keeps it alive.</p>
        </div>
        <WeeklyStreakMock />
      </section>

      <Card
        as="section"
        className="mock-resume-card"
        variant="mockSoft"
        padding="none"
        aria-label="Pick up where you left off"
      >
        <div className="mock-resume-card__copy">
          <div className="mock-kicker">
            <Sparkles size={18} aria-hidden="true" />
            <span>Pick up where you left off</span>
          </div>
          <div className="mock-resume-card__title-row">
            <h2>Major Third</h2>
            <span>Intervals · A major</span>
          </div>
          <p>Your thirds slipped flat last session — let’s lock them in.</p>
          <div className="mock-resume-card__actions">
            <button
              className="mock-primary-action"
              type="button"
              onClick={() => onSelectExercise("third-up-back")}
              disabled={disabled}
            >
              <Play size={17} fill="currentColor" aria-hidden="true" />
              <span>Resume practice</span>
            </button>
            <span>
              <strong>78%</strong>
              best so far
            </span>
          </div>
        </div>
        <MockPitchPreview />
      </Card>

      <section className="mock-mode-grid" aria-label="Practice modes">
        <Card
          as="button"
          className="mock-mode-card mock-mode-card--practice"
          variant="mockInteractive"
          padding="none"
          type="button"
          onClick={onNavigateToPractice}
        >
          <div className="mock-mode-card__header">
            <span className="mock-mode-icon mock-mode-icon--practice">
              <Target size={26} aria-hidden="true" />
            </span>
            <span className="mock-mode-copy">
              <strong>Interval Training</strong>
              <span>12 guided drills · ear & voice</span>
            </span>
            <ArrowUpRight size={27} aria-hidden="true" />
          </div>
          <div className="mock-chip-row" aria-hidden="true">
            <span>Warm-ups</span>
            <span>Intervals</span>
            <span>Triads</span>
            <span>Scales</span>
          </div>
          <div className="mock-practice-progress">
            <span />
            <strong>23 <span>/ 48 done</span></strong>
          </div>
        </Card>

        <Card
          as="button"
          className="mock-mode-card mock-mode-card--song"
          variant="mockInteractive"
          padding="none"
          type="button"
          onClick={onNavigateToSongs}
        >
          <div className="mock-mode-card__header">
            <span className="mock-mode-icon mock-mode-icon--song">
              <Mic size={27} aria-hidden="true" />
            </span>
            <span className="mock-mode-copy">
              <strong>Sing a Song</strong>
              <span>Upload a track · sing the real vocal</span>
            </span>
            <ArrowUpRight size={27} aria-hidden="true" />
          </div>
          <div className="mock-song-dropzone">
            <span className="mock-upload-icon">
              <Upload size={28} aria-hidden="true" />
            </span>
            <strong>Drop a song to begin</strong>
            <span>We split the vocal & map it to pitch targets — locally, in under a minute.</span>
          </div>
        </Card>
      </section>

      <section className="mock-stat-grid" aria-label="Practice stats">
        <StatCard
          className="mock-stat-card"
          variant="mock"
          padding="none"
          icon={<Flame size={19} />}
          label="Day streak"
          value="12"
          valueClassName="mock-stat-card__value--accent"
        />
        <StatCard
          className="mock-stat-card"
          variant="mock"
          padding="none"
          icon={<LineChart size={19} />}
          label="Accuracy"
          value="87"
          unit="%"
          trend={<MockAccuracySparkline />}
        />
        <StatCard
          className="mock-stat-card"
          variant="mock"
          padding="none"
          icon={<CheckCircle2 size={18} />}
          label="Notes in tune"
          value="1,284"
          valueClassName="mock-stat-card__value--green"
        />
        <StatCard
          className="mock-stat-card"
          variant="mock"
          padding="none"
          icon={<Clock3 size={18} />}
          label="Practiced"
          value="142"
          unit="min"
        />
      </section>
    </main>
  );
}

function WeeklyStreakMock() {
  const days = [
    { label: "M", done: true },
    { label: "T", done: true },
    { label: "W", done: true },
    { label: "T", done: false },
    { label: "F", done: true },
    { label: "S", done: true },
    { label: "S", done: true }
  ];

  return (
    <div className="mock-week-streak" aria-label="Weekly streak">
      {days.map((day, index) => (
        <span key={`${day.label}-${index}`} className="mock-week-streak__day">
          <span className={day.done ? "mock-week-streak__box is-done" : "mock-week-streak__box"}>
            {day.done ? <CheckIcon /> : null}
          </span>
          <span>{day.label}</span>
        </span>
      ))}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
      <path d="m7 12 3 3 7-7" />
    </svg>
  );
}

function MockPitchPreview() {
  return (
    <div className="mock-pitch-preview" aria-hidden="true">
      <svg viewBox="0 0 420 230" preserveAspectRatio="none">
        <path className="mock-pitch-preview__grid" d="M20 34H400M20 81H400M20 128H400M20 175H400" />
        <path className="mock-pitch-preview__guide" d="M50 150H140M150 104H245M255 58H318" />
        <path
          className="mock-pitch-preview__line"
          d="M30 170 C40 148 38 132 58 132 C92 132 100 132 113 132 C140 132 143 105 169 101 C197 98 210 101 239 100 C260 100 260 84 280 66 C301 47 305 22 311 32 C318 48 322 58 350 57 C368 57 383 58 400 57"
        />
        <circle className="mock-pitch-preview__dot" cx="47" cy="132" r="5" />
        <circle className="mock-pitch-preview__dot" cx="168" cy="101" r="5" />
        <circle className="mock-pitch-preview__dot" cx="311" cy="57" r="5" />
      </svg>
    </div>
  );
}

function MockAccuracySparkline() {
  return (
    <svg className="mock-accuracy-sparkline" viewBox="0 0 150 48" aria-hidden="true">
      <path d="M5 35 C18 28 22 22 33 29 C43 37 47 20 60 18 C76 15 75 6 92 8 C104 10 104 1 119 4 C132 7 134 0 145 0" />
    </svg>
  );
}

function PracticeLibraryScreen(props: LibraryScreenProps) {
  return (
    <main className="mock-practice-page" aria-label="Pitch coach exercises">
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
    <main className="mock-home mock-progress" aria-label="Pitch coach progress">
      <section className="mock-home__header mock-progress__header">
        <div>
          <h1>Your Progress</h1>
          <p>Review attempts, note accuracy, weekly activity, and drill progress saved on this device.</p>
        </div>
      </section>
      <section className="mock-stat-grid progress-summary-grid" aria-label="Progress summary">
        <StatCard
          className="mock-stat-card"
          variant="mock"
          padding="none"
          icon={<Flame size={19} />}
          label="Day streak"
          value={practiceSummary.streakDays}
          valueClassName="mock-stat-card__value--accent"
        />
        <StatCard
          className="mock-stat-card"
          variant="mock"
          padding="none"
          icon={<LineChart size={19} />}
          label="Accuracy"
          value={practiceSummary.noteAccuracy ?? 0}
          unit="%"
          trend={<MockAccuracySparkline />}
        />
        <StatCard
          className="mock-stat-card"
          variant="mock"
          padding="none"
          icon={<CheckCircle2 size={18} />}
          label="Notes in tune"
          value={practiceSummary.notesInTune}
          valueClassName="mock-stat-card__value--green"
        />
        <StatCard
          className="mock-stat-card"
          variant="mock"
          padding="none"
          icon={<Clock3 size={18} />}
          label="Practiced"
          value={practiceSummary.practiceMinutes}
          unit="min"
        />
      </section>
      {!hasHistory ? (
        <Card variant="mock" padding="lg">
          <CardHeader>
            <CardTitle>No attempts yet</CardTitle>
            <CardDescription>
              Complete a guided exercise and your local progress dashboard will fill in here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <section className="progress-dashboard-grid">
          <Card className="progress-week-card" variant="mock" padding="lg">
            <CardHeader>
              <CardTitle>Last 7 Days</CardTitle>
              <CardDescription>Attempts saved in this browser.</CardDescription>
            </CardHeader>
            <CardContent>
              <WeekActivityStrip buckets={practiceSummary.weekActivity} />
            </CardContent>
          </Card>

          <Card className="progress-exercises-card" variant="mock" padding="lg">
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

          <Card className="progress-sessions-card" variant="mock" padding="lg">
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

type PracticeExerciseDisplay = {
  keyLabel: string;
  completedCount: number;
  accuracy: number | null;
  difficulty: 1 | 2 | 3;
};

const PRACTICE_LIBRARY_TOTAL_DRILLS = 48;
const PRACTICE_LIBRARY_COMPLETED_DRILLS = 23;
const PRACTICE_LIBRARY_ACCURACY = 87;

const practiceExerciseDisplayFallbacks: Record<ExerciseId, PracticeExerciseDisplay> = {
  "single-note-match": {
    keyLabel: "C major",
    completedCount: 8,
    accuracy: 94,
    difficulty: 1
  },
  "single-note-sustain": {
    keyLabel: "free",
    completedCount: 5,
    accuracy: 91,
    difficulty: 1
  },
  "step-up-back": {
    keyLabel: "D major",
    completedCount: 6,
    accuracy: 96,
    difficulty: 1
  },
  "third-up-back": {
    keyLabel: "A major",
    completedCount: 2,
    accuracy: 78,
    difficulty: 2
  },
  "major-triad": {
    keyLabel: "E major",
    completedCount: 4,
    accuracy: 90,
    difficulty: 2
  },
  "descending-triad": {
    keyLabel: "A minor",
    completedCount: 1,
    accuracy: 81,
    difficulty: 2
  },
  "five-note-scale": {
    keyLabel: "C major",
    completedCount: 2,
    accuracy: 85,
    difficulty: 2
  },
  "octave-arpeggio": {
    keyLabel: "G major",
    completedCount: 0,
    accuracy: null,
    difficulty: 3
  }
};

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
        return {
          value: category,
          label: formatPracticeFilterLabel(category)
        };
      }),
    []
  );
  const completedExerciseCount = useMemo(
    () =>
      exercises.filter((exercise) => {
        const progress = exerciseProgress[exercise.id];
        return progress.attemptCount > 0;
      }).length,
    [exerciseProgress, exercises]
  );
  const displayedCompletedExerciseCount =
    completedExerciseCount > 0 ? completedExerciseCount : PRACTICE_LIBRARY_COMPLETED_DRILLS;
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
          <h1>Practice Library</h1>
          <p>
            {PRACTICE_LIBRARY_TOTAL_DRILLS} drills · <b>{displayedCompletedExerciseCount}</b>{" "}
            completed · keep your ear &amp; voice sharp
          </p>
        </div>
        <div className="library-heading__stat" aria-label={`${PRACTICE_LIBRARY_ACCURACY}% accuracy`}>
          <LineChart size={16} aria-hidden="true" />
          <strong>{PRACTICE_LIBRARY_ACCURACY}%</strong>
          <span className="library-heading__spark">
            <MockAccuracySparkline />
          </span>
        </div>
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
              <span className="exercise-group__icon" aria-hidden="true">
                {getPracticeCategoryIcon(group.category)}
              </span>
              <h3 id={`exercise-group-${group.category}`}>{formatCategoryLabel(group.category)}</h3>
              <span>{group.exercises.length}</span>
              <span className="exercise-group__line" aria-hidden="true" />
            </div>
            <div className="exercise-list">
              {group.exercises.map((exercise, exerciseIndex) => {
                const isSelected = exercise.id === selectedExerciseId;
                const progress = exerciseProgress[exercise.id];
                const display = getPracticeExerciseDisplay(exercise, progress);
                const isComplete = display.completedCount > 0;
                return (
                  <button
                    key={exercise.id}
                    className={`exercise-option ${isSelected ? "exercise-option-active" : ""}`}
                    type="button"
                    onClick={() => onSelectExercise(exercise.id)}
                    aria-pressed={isSelected}
                    disabled={disabled}
                  >
                    <span className={`exercise-status-tile ${isComplete ? "is-complete" : ""}`}>
                      {isComplete ? (
                        <Check size={15} strokeWidth={2.4} aria-hidden="true" />
                      ) : (
                        <span aria-hidden="true">{exerciseIndex + 1}</span>
                      )}
                    </span>
                    <span className="exercise-copy">
                      <strong>{exercise.title}</strong>
                      <span className="exercise-key">{display.keyLabel}</span>
                    </span>
                    <span
                      className="exercise-difficulty-dots"
                      aria-label={`Difficulty ${display.difficulty} of 3`}
                    >
                      {[1, 2, 3].map((dot) => (
                        <span
                          key={dot}
                          className={`exercise-difficulty-dot ${
                            dot <= display.difficulty ? "is-active" : ""
                          }`}
                        />
                      ))}
                    </span>
                    <span
                      className={`exercise-score ${
                        display.accuracy === null ? "exercise-score--new" : ""
                      }`}
                    >
                      {display.accuracy === null ? "New" : `${display.accuracy}%`}
                    </span>
                    <span className="exercise-progress-detail">{formatProgressSummary(progress)}</span>
                    <span className="exercise-start" aria-hidden="true">
                      <Play size={13} fill="currentColor" />
                    </span>
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

function getPracticeExerciseDisplay(
  exercise: ExerciseDefinition,
  progress: ExerciseProgressSummary
): PracticeExerciseDisplay {
  const fallback = practiceExerciseDisplayFallbacks[exercise.id];
  const recentAccuracy = progress.recentPassRate ?? fallback.accuracy ?? null;
  const completedCount = progress.attemptCount > 0 ? progress.attemptCount : fallback.completedCount;
  const difficulty = Math.min(3, Math.max(1, fallback.difficulty ?? exercise.difficulty)) as 1 | 2 | 3;

  return {
    keyLabel: fallback.keyLabel,
    completedCount,
    accuracy: recentAccuracy,
    difficulty
  };
}

function getPracticeCategoryIcon(category: ExerciseCategory) {
  switch (category) {
    case "pitch":
      return <Activity size={17} strokeWidth={1.7} />;
    case "interval":
    case "arpeggio":
      return <Target size={17} strokeWidth={1.7} />;
    case "scale":
      return <LineChart size={17} strokeWidth={1.7} />;
  }
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

function formatCategoryLabel(category: ExerciseCategoryFilter) {
  switch (category) {
    case "all":
      return "All";
    case "pitch":
      return "Warm-ups";
    case "interval":
      return "Intervals";
    case "arpeggio":
      return "Triads & Chords";
    case "scale":
      return "Scales";
  }
}

function formatPracticeFilterLabel(category: ExerciseCategoryFilter) {
  if (category === "arpeggio") {
    return "Triads";
  }

  return formatCategoryLabel(category);
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

function getExerciseTitle(
  exercises: ReturnType<typeof usePitchCoachController>["exercises"],
  exerciseId: ExerciseId
) {
  return exercises.find((exercise) => exercise.id === exerciseId)?.title ?? "Exercise";
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
