import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Activity,
  ArrowUpRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Flame,
  Gauge,
  Home,
  LineChart,
  Mic,
  Pause,
  Music2,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Volume2
} from "lucide-react";
import { Dropdown, type DropdownOption } from "../components/Dropdown";
import { PitchTimeline } from "../components/PitchTimeline";
import {
  RangeSetupModal,
  RangeSetupToast
} from "../components/range/RangeSetupModal";
import { AppShell } from "../components/ui/AppShell";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "../components/ui/Card";
import { IconButton } from "../components/ui/IconButton";
import { SidebarNav } from "../components/ui/SidebarNav";
import { SidebarTabs, type SidebarTabItem } from "../components/ui/SidebarTabs";
import { StatCard } from "../components/ui/StatCard";
import type {
  AttemptScore,
  CoachSettings,
  ExerciseCategory,
  ExerciseDefinition,
  ExerciseId,
  ExerciseProgressSummary,
  LessonStatus,
  PracticeMode,
  SegmentAssessmentStatus,
  TargetSegment
} from "../domain/contracts";
import { isExerciseId } from "../domain/exercise";
import { midiToNoteName } from "../domain/music";
import { getGuidePlaybackFrame, getPromptTimeline } from "../domain/promptTiming";
import { SongPracticeScreen } from "../song/SongPracticeScreen";
import type { SongModeServices } from "../song/types";
import { usePitchCoachTheme } from "./theme";
import { usePitchCoachController, type PitchCoachControllerOptions } from "./usePitchCoachController";

export type PitchCoachAppProps = PitchCoachControllerOptions & {
  songServices?: SongModeServices;
};

const APP_BASE_PATH = normalizeBasePath(import.meta.env.BASE_URL);
const PITCH_COACH_LOGO_URL = `${import.meta.env.BASE_URL}pitch-coach-logo.png`;

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

type RangeSetupRequest = "start" | "edit";

function ExercisePracticeApp({ router, coachOptions, songServices }: ExercisePracticeAppProps) {
  const coach = usePitchCoachController({
    ...coachOptions,
    initialExerciseId: router.route.screen === "practice" ? router.route.exerciseId : undefined
  });
  const activeTheme = usePitchCoachTheme(coach.settings.themePreference);
  const activePracticeExerciseId =
    router.route.screen === "practice" ? router.route.exerciseId : null;
  const [rangeSetupRequest, setRangeSetupRequest] = useState<RangeSetupRequest | null>(null);
  const [practicePaused, setPracticePaused] = useState(false);
  const [transportProgress, setTransportProgress] = useState(0);
  const [guideProgress, setGuideProgress] = useState(0);
  const replayAudioRef = useRef<HTMLAudioElement | null>(null);

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

  useEffect(() => {
    if (router.route.screen !== "practice") {
      setRangeSetupRequest(null);
      setPracticePaused(false);
      void coach.stopRangeCapture();
    }
  }, [coach.stopRangeCapture, router.route.screen]);

  useEffect(() => {
    if (coach.settings.practiceMode === "manual") {
      setPracticePaused(false);
    }
  }, [coach.settings.practiceMode]);

  useEffect(() => {
    if (coach.settings.practiceMode !== "manual") {
      return;
    }

    if (coach.lessonState.status === "promptPlaying" || coach.lessonState.status === "awaitingVoice") {
      setTransportProgress(0);
      return;
    }

    if (coach.lessonState.status !== "listening" && coach.lessonState.status !== "scoring") {
      return;
    }

    const latestFrameMs = coach.pitchFrames.at(-1)?.timeMs;
    if (latestFrameMs === undefined) {
      return;
    }

    setTransportProgress(Math.min(1, Math.max(0, latestFrameMs / Math.max(coach.listeningDurationMs, 1))));
  }, [
    coach.lessonState.status,
    coach.listeningDurationMs,
    coach.pitchFrames,
    coach.settings.practiceMode
  ]);

  useEffect(() => {
    if (router.route.screen !== "practice" || coach.lessonState.status !== "promptPlaying") {
      setGuideProgress(0);
      return;
    }

    let frameId = 0;
    const startedAt = performance.now();
    const durationMs = getPromptTimeline(
      coach.targetSegments,
      coach.settings.tempoBpm,
      coach.selectedExercise.promptStyle
    ).totalDurationMs;

    const tick = (timestamp: number) => {
      const nextProgress = Math.min(1, Math.max(0, (timestamp - startedAt) / durationMs));
      setGuideProgress(nextProgress);
      if (nextProgress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    setGuideProgress(0);
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [
    coach.lessonState.status,
    coach.selectedExercise.promptStyle,
    coach.settings.tempoBpm,
    coach.targetSegments,
    router.route.screen
  ]);

  useEffect(() => {
    return () => {
      replayAudioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    replayAudioRef.current?.pause();
    replayAudioRef.current = null;
    setTransportProgress(0);
  }, [coach.localClip?.url]);

  useEffect(() => {
    if (!activePracticeExerciseId) {
      return;
    }

    coach.startPracticeSession(activePracticeExerciseId);
    return () => coach.endPracticeSession(activePracticeExerciseId);
  }, [activePracticeExerciseId, coach.endPracticeSession, coach.startPracticeSession]);

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

  const closeRangeSetup = () => {
    void coach.stopRangeCapture();
    setRangeSetupRequest(null);
  };

  const continueAfterRangeSetup = () => {
    const shouldStart = rangeSetupRequest === "start";
    void coach.stopRangeCapture();
    setRangeSetupRequest(null);
    if (shouldStart) {
      setPracticePaused(false);
      void coach.startAttempt({ includePrompt: coach.settings.practiceMode !== "manual" });
    }
  };

  const skipRangeSetup = () => {
    const shouldStart = rangeSetupRequest === "start";
    void coach.stopRangeCapture();
    coach.skipRangeSetup();
    setRangeSetupRequest(null);
    if (shouldStart) {
      setPracticePaused(false);
      void coach.startAttempt({ includePrompt: coach.settings.practiceMode !== "manual" });
    }
  };

  const runPrimaryAction = useCallback(() => {
    if (coach.lessonState.status === "complete") {
      void coach.resetLesson();
      return;
    }

    if (coach.settings.rangeSetup.status === "unseen") {
      setRangeSetupRequest("start");
      return;
    }

    if (coach.settings.practiceMode === "manual") {
      setPracticePaused(false);
      void coach.startAttempt({ includePrompt: false });
      return;
    }

    setPracticePaused(false);
    void coach.startAttempt();
  }, [
    coach.lessonState.status,
    coach.resetLesson,
    coach.settings.practiceMode,
    coach.settings.rangeSetup.status,
    coach.startAttempt
  ]);

  const toggleAutoPractice = useCallback(() => {
    if (coach.settings.practiceMode !== "auto") {
      return;
    }

    if (isAutoPracticeActive(coach.lessonState.status, coach.isBusy)) {
      setPracticePaused(true);
      void coach.stopAttempt();
      return;
    }

    runPrimaryAction();
  }, [
    coach.isBusy,
    coach.lessonState.status,
    coach.settings.practiceMode,
    coach.stopAttempt,
    runPrimaryAction
  ]);

  useEffect(() => {
    if (router.route.screen !== "practice" || coach.settings.practiceMode !== "auto") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditableShortcutTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      toggleAutoPractice();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [coach.settings.practiceMode, router.route.screen, toggleAutoPractice]);

  const rangeSetupModal = (
    <RangeSetupModal
      open={rangeSetupRequest !== null}
      initialRange={coach.settings.range}
      captureState={coach.rangeCaptureState}
      allowSkip={rangeSetupRequest === "start"}
      savedContext={rangeSetupRequest === "edit" ? "edit" : "start"}
      completionLabel={rangeSetupRequest === "edit" ? "Done" : "Start practicing"}
      onStartCapture={(target) => void coach.startRangeCapture(target)}
      onStopCapture={() => void coach.stopRangeCapture()}
      onSave={coach.saveRangeSetup}
      onSkip={skipRangeSetup}
      onDismiss={closeRangeSetup}
      onContinue={continueAfterRangeSetup}
    />
  );

  if (router.route.screen !== "practice") {
    return (
      <MainShell
        activeScreen={router.route.screen}
        onNavigate={navigateTopLevel}
        practiceSummary={coach.practiceSummary}
      >
        {router.route.screen === "home" ? (
          <HomeScreen
            exercises={coach.exercises}
            selectedExerciseId={coach.selectedExercise.id}
            exerciseProgress={coach.exerciseProgress}
            practiceSummary={coach.practiceSummary}
            recommendedExercise={coach.recommendedExercise}
            range={coach.settings.range}
            rangeSetupStatus={coach.settings.rangeSetup.status}
            onOpenRangeSetup={() => setRangeSetupRequest("edit")}
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
            practiceSummary={coach.practiceSummary}
            range={coach.settings.range}
            rangeSetupStatus={coach.settings.rangeSetup.status}
            onOpenRangeSetup={() => setRangeSetupRequest("edit")}
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
            recentSessions={coach.recentSessions}
            onSelectExercise={openExercise}
          />
        )}
        {rangeSetupModal}
      </MainShell>
    );
  }

  const exerciseOptions = coach.exercises.map((exercise) => ({
    value: exercise.id,
    label: exercise.title
  })) satisfies DropdownOption<(typeof coach.exercises)[number]["id"]>[];
  const practiceStatusView = createPracticeStatusView(coach.lessonState.status, coach.attemptScore);
  const coachGuidance = createCoachGuidance({
    status: coach.lessonState.status,
    exerciseTitle: coach.selectedExercise.title,
    targetSegments: coach.targetSegments,
    attemptScore: coach.attemptScore
  });
  const targetsInTuneCount =
    coach.attemptScore?.segments.filter((segment) =>
      segment.score ? ["pass", "passWithWarning"].includes(segment.score.status) : false
    ).length ?? 0;
  const strictness = getStrictnessOption(coach.settings.toleranceCents);
  const mode = coach.settings.practiceMode;
  const canStepKeyDown = coach.currentRootIndex > 0 && !coach.isBusy;
  const canStepKeyUp = coach.currentRootIndex < coach.rootSequence.length - 1 && !coach.isBusy;
  const restartAutoPractice = async () => {
    setPracticePaused(false);
    await coach.resetLesson();
  };
  const scrubManualTransport = (progress: number) => {
    const nextProgress = Math.min(1, Math.max(0, progress));
    setTransportProgress(nextProgress);

    const audio = replayAudioRef.current;
    if (!audio || !coach.localClip) {
      return;
    }

    audio.currentTime = nextProgress * Math.max(coach.localClip.durationMs / 1000, 0);
  };
  const replayLatestTake = () => {
    if (!coach.localClip) {
      setTransportProgress(0);
      return;
    }

    const audio = replayAudioRef.current ?? new Audio(coach.localClip.url);
    replayAudioRef.current = audio;
    audio.src = coach.localClip.url;
    audio.currentTime = transportProgress * Math.max(coach.localClip.durationMs / 1000, 0);
    audio.ontimeupdate = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
        return;
      }
      setTransportProgress(Math.min(1, Math.max(0, audio.currentTime / audio.duration)));
    };
    audio.onended = () => setTransportProgress(0);
    void audio.play().catch(() => undefined);
  };
  const tempoProgress = calculateTempoProgress(coach.settings.tempoBpm);
  const activeTempoPreset = getActiveTempoPreset(coach.settings.tempoBpm);
  const autoToggleLabel = isAutoPracticeActive(coach.lessonState.status, coach.isBusy)
    ? "Pause practice"
    : practicePaused
      ? "Resume practice"
      : createPrimaryPracticeLabel(coach.lessonState.status, coach.selectedExercise, mode);
  const guidePlaybackFrame =
    coach.lessonState.status === "promptPlaying"
      ? getGuidePlaybackFrame(
          coach.targetSegments,
          coach.settings.tempoBpm,
          coach.selectedExercise.promptStyle,
          guideProgress
        )
      : {
          phase: "tail" as const,
          playheadMs: null,
          activeSegmentIndices: []
        };

  return (
    <MainShell activeScreen="library" onNavigate={navigateTopLevel} practiceSummary={coach.practiceSummary}>
      <main className="exercise-screen-page">
        <section className="exercise-screen" aria-label="Pitch coach exercise">
          <header className="exercise-screen__header">
            <div className="exercise-screen__title-row">
              <IconButton
                className="exercise-back-action"
                size="lg"
                onClick={() => void backToLibrary()}
                aria-label="Back to exercises"
                title="Back to exercises"
              >
                <ArrowLeft size={18} />
              </IconButton>
              <div className="exercise-screen__title-copy">
                <Dropdown
                  ariaLabel="Exercise"
                  value={coach.selectedExercise.id}
                  options={exerciseOptions}
                  onValueChange={openExercise}
                  disabled={coach.isBusy}
                  triggerClassName="practice-title-dropdown"
                />
                <p>
                  {formatCategoryLabel(coach.selectedExercise.category)} · Take {coach.lessonState.attemptNumber + 1}
                </p>
              </div>
            </div>
            <div className="exercise-control-bar" aria-label="Exercise controls">
              <span className="visually-hidden">{coach.currentKeyLabel}</span>
              <ExerciseSettingPopover
                ariaLabel="Key"
                icon={<Activity size={18} />}
                label="Key"
                value={`${formatKeyName(coach.currentRootMidi)} major`}
              >
                <div className="exercise-key-stepper">
                  <button
                    type="button"
                    onClick={() => void coach.setCurrentRootIndex(coach.currentRootIndex - 1)}
                    disabled={!canStepKeyDown}
                    aria-label="Lower key"
                  >
                    -
                  </button>
                  <span>
                    <strong>{formatKeyName(coach.currentRootMidi)}</strong>
                    <small>{coach.currentKeyLabel}</small>
                  </span>
                  <button
                    type="button"
                    onClick={() => void coach.setCurrentRootIndex(coach.currentRootIndex + 1)}
                    disabled={!canStepKeyUp}
                    aria-label="Raise key"
                  >
                    +
                  </button>
                </div>
                <p className="exercise-popover-note">
                  Fits your range · {midiToNoteName(coach.settings.range.lowestMidi)}-
                  {midiToNoteName(coach.settings.range.highestMidi)}
                </p>
              </ExerciseSettingPopover>
              <ExerciseSettingPopover
                ariaLabel="Strictness"
                icon={<Target size={18} />}
                label="Strictness"
                value={strictness.label}
              >
                <div className="exercise-segmented-row" role="group" aria-label="Strictness">
                  {STRICTNESS_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      data-active={option.id === strictness.id || undefined}
                      onClick={() =>
                        coach.setSettings({
                          ...coach.settings,
                          toleranceCents: option.cents
                        })
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="exercise-popover-note">
                  Within ±{strictness.cents} cents counts as in-tune.
                </p>
              </ExerciseSettingPopover>
              <ExerciseSettingPopover
                ariaLabel="Tempo"
                icon={<Clock3 size={18} />}
                label="Tempo"
                value={`${coach.settings.tempoBpm} BPM`}
                contentClassName="exercise-setting-popover__content--tempo"
              >
                <div className="exercise-tempo-control">
                  <input
                    aria-label="Guide tempo"
                    className="exercise-tempo-slider"
                    type="range"
                    min="60"
                    max="120"
                    step="2"
                    value={coach.settings.tempoBpm}
                    style={{ "--tempo-progress": `${tempoProgress}%` } as CSSProperties}
                    onChange={(event) =>
                      coach.setSettings({
                        ...coach.settings,
                        tempoBpm: Number(event.target.value)
                      })
                    }
                  />
                  <div className="exercise-tempo-presets" role="group" aria-label="Tempo presets">
                    {TEMPO_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        data-active={activeTempoPreset.label === preset.label || undefined}
                        onClick={() =>
                          coach.setSettings({
                            ...coach.settings,
                            tempoBpm: preset.bpm
                          })
                        }
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </ExerciseSettingPopover>
              <span className="exercise-control-divider" aria-hidden="true" />
              <div className="exercise-mode-toggle" role="group" aria-label="Practice mode">
                {(["auto", "manual"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={mode === option}
                    data-active={mode === option || undefined}
                    disabled={coach.isBusy}
                    onClick={() =>
                      coach.setSettings({
                        ...coach.settings,
                        practiceMode: option
                      })
                    }
                  >
                    {option === "auto" ? <Play size={16} fill="currentColor" /> : <Target size={16} />}
                    <span>{option === "auto" ? "Auto" : "Manual"}</span>
                  </button>
                ))}
              </div>
              {mode === "auto" ? (
                <button
                  type="button"
                  className="exercise-header-toggle"
                  onClick={toggleAutoPractice}
                  aria-label={autoToggleLabel}
                  title={autoToggleLabel}
                >
                  {isAutoPracticeActive(coach.lessonState.status, coach.isBusy) ? (
                    <Pause size={18} fill="currentColor" />
                  ) : coach.lessonState.status === "complete" ? (
                    <RotateCcw size={18} />
                  ) : (
                    <Play size={18} fill="currentColor" />
                  )}
                </button>
              ) : null}
            </div>
          </header>

          <section className="exercise-coach-row" aria-label="Practice guidance">
            <div className="exercise-coach-mark" aria-hidden="true">
              <Music2 size={23} />
            </div>
            <div className="exercise-coach-bubble">
              <strong>{createMockCoachTitle(coach.lessonState.status, mode)}</strong>
              <span>{createMockCoachMessage(coachGuidance, coach.lessonState.status, mode)}</span>
            </div>
          </section>

          <section className="exercise-roll-card">
            <div className="practice-target-row">
              <NoteCheckpointStrip
                targetSegments={coach.targetSegments}
                attemptScore={coach.attemptScore}
                activeSegmentIndices={guidePlaybackFrame.activeSegmentIndices}
                guideActive={coach.lessonState.status === "promptPlaying"}
              />
              <div className="practice-score-readout" aria-label={`${targetsInTuneCount} notes in tune`}>
                <strong>
                  {targetsInTuneCount}
                  <span>/{coach.targetSegments.length}</span>
                </strong>
                <span>notes in tune</span>
              </div>
            </div>

            <PitchTimeline
              frames={coach.pitchFrames}
              targetSegments={coach.targetSegments}
              attemptScore={coach.attemptScore}
              totalDurationMs={coach.listeningDurationMs}
              toleranceCents={coach.settings.toleranceCents}
              status={coach.lessonState.status}
              themeName={activeTheme.name}
              guidePlayheadMs={guidePlaybackFrame.playheadMs}
              guideActiveSegmentIndices={guidePlaybackFrame.activeSegmentIndices}
            />
          </section>

          <section className="exercise-action-bar" aria-label="Practice transport">
            <ExerciseTransport
              mode={mode}
              status={coach.lessonState.status}
              statusView={practiceStatusView}
              isBusy={coach.isBusy}
              isPaused={practicePaused}
              progress={transportProgress}
              canReplayTake={Boolean(coach.localClip)}
              primaryLabel={createPrimaryPracticeLabel(coach.lessonState.status, coach.selectedExercise, mode)}
              onPrimaryAction={runPrimaryAction}
              onPlayGuide={() => void coach.playGuide()}
              onReplayTake={replayLatestTake}
              onScrub={scrubManualTransport}
              onResume={runPrimaryAction}
              onRestart={() => void restartAutoPractice()}
              onAdvance={() => void coach.advanceLesson()}
            />
          </section>

          {coach.errorMessage ? (
            <div className="error-banner" role="alert">
              {coach.errorMessage}
            </div>
          ) : null}
        </section>
        {rangeSetupModal}
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

function createAutoTransportView(status: LessonStatus, fallback: PracticeStatusView) {
  switch (status) {
    case "idle":
      return {
        label: "Ready to begin",
        detail: "Press play to start auto-practice.",
        tone: "idle" as const,
        icon: <Play size={16} fill="currentColor" />
      };
    case "promptPlaying":
      return {
        label: "Listening to the guide...",
        detail: "Reference is playing.",
        tone: "info" as const,
        pulse: true,
        icon: null
      };
    case "awaitingVoice":
      return {
        label: "Get ready...",
        detail: "Sing after the cue.",
        tone: "accent" as const,
        icon: <Mic size={16} />
      };
    case "listening":
      return {
        label: "Listening to you...",
        detail: "Pitch is being tracked locally.",
        tone: "accent" as const,
        pulse: true,
        icon: null
      };
    case "scoring":
      return {
        label: "Scoring locally...",
        detail: "Checking pitch centers and contour.",
        tone: "info" as const,
        pulse: true,
        icon: null
      };
    case "passed":
      return {
        label: "Nailed it - moving on",
        detail: "Next key is queued.",
        tone: "success" as const,
        icon: <CheckCircle2 size={16} />
      };
    case "retry":
      return {
        label: "Replaying the targets...",
        detail: "Listen, then sing it back.",
        tone: "warning" as const,
        icon: <RotateCcw size={16} />
      };
    case "complete":
      return {
        label: "Lesson complete",
        detail: fallback.detail,
        tone: "success" as const,
        icon: <CheckCircle2 size={16} />
      };
  }
}

function isAutoPracticeActive(status: LessonStatus, isBusy: boolean) {
  return isBusy || status === "passed";
}

function calculateTempoProgress(tempoBpm: number) {
  return Math.min(100, Math.max(0, ((tempoBpm - 60) / 60) * 100));
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      "a, button, input, textarea, select, [contenteditable='true'], [role='textbox'], [role='slider']"
    )
  );
}

function createCoachGuidance({
  status,
  exerciseTitle,
  targetSegments,
  attemptScore
}: {
  status: LessonStatus;
  exerciseTitle: string;
  targetSegments: TargetSegment[];
  attemptScore: AttemptScore | null;
}): CoachGuidanceView {
  const targetPattern = formatTargetSegmentPattern(targetSegments);

  switch (status) {
    case "idle":
      return {
        title: exerciseTitle,
        message: `Listen to the guide, then sing ${targetPattern}.`,
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
        message: "Aim for clean centers and smooth motion between targets.",
        tone: "accent",
        icon: <Activity size={18} />
      };
    case "scoring":
      return {
        title: "Checking your take",
        message: "Pitch centers, contours, stability, and missed targets are being scored locally.",
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

const STRICTNESS_OPTIONS = [
  { id: "gentle", label: "Gentle", cents: 50 },
  { id: "standard", label: "Standard", cents: 35 },
  { id: "strict", label: "Strict", cents: 22 }
] as const;

const TEMPO_PRESETS = [
  { label: "Slow", bpm: 70 },
  { label: "Medium", bpm: 90 },
  { label: "Brisk", bpm: 110 }
] as const;

type StrictnessOption = (typeof STRICTNESS_OPTIONS)[number];

function getStrictnessOption(toleranceCents: number): StrictnessOption {
  return STRICTNESS_OPTIONS.reduce((nearest, option) =>
    Math.abs(option.cents - toleranceCents) < Math.abs(nearest.cents - toleranceCents)
      ? option
      : nearest
  );
}

function getActiveTempoPreset(tempoBpm: number) {
  return TEMPO_PRESETS.reduce((nearest, preset) =>
    Math.abs(preset.bpm - tempoBpm) < Math.abs(nearest.bpm - tempoBpm) ? preset : nearest
  );
}

function ExerciseSettingPopover({
  ariaLabel,
  icon,
  label,
  value,
  contentClassName,
  children
}: {
  ariaLabel: string;
  icon: ReactNode;
  label: string;
  value: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div className="exercise-setting-popover" ref={rootRef}>
      <button
        type="button"
        className="exercise-setting-chip"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="exercise-setting-chip__icon">{icon}</span>
        <span className="exercise-setting-chip__copy">
          <span>{label}</span>
          <strong>{value}</strong>
        </span>
        <span className="exercise-setting-chip__chevron" aria-hidden="true">
          ›
        </span>
      </button>
      {open ? (
        <div
          className={`exercise-setting-popover__content ${contentClassName ?? ""}`.trim()}
          role="dialog"
          aria-label={`${label} settings`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function ExerciseTransport({
  mode,
  status,
  statusView,
  isBusy,
  isPaused,
  progress,
  canReplayTake,
  primaryLabel,
  onPrimaryAction,
  onPlayGuide,
  onReplayTake,
  onScrub,
  onResume,
  onRestart,
  onAdvance
}: {
  mode: PracticeMode;
  status: LessonStatus;
  statusView: PracticeStatusView;
  isBusy: boolean;
  isPaused: boolean;
  progress: number;
  canReplayTake: boolean;
  primaryLabel: string;
  onPrimaryAction: () => void;
  onPlayGuide: () => void;
  onReplayTake: () => void;
  onScrub: (progress: number) => void;
  onResume: () => void;
  onRestart: () => void;
  onAdvance: () => void;
}) {
  if (mode === "manual") {
    return (
      <>
        <IconButton
          size="lg"
          variant="toolbar"
          onClick={onPlayGuide}
          disabled={isBusy || status === "complete"}
          aria-label="Hear guide"
          title="Hear guide"
        >
          <Play size={18} fill="currentColor" />
        </IconButton>
        <IconButton
          size="lg"
          variant="toolbar"
          onClick={onReplayTake}
          disabled={!canReplayTake}
          aria-label="Replay take"
          title={canReplayTake ? "Replay take" : "Save local clips to replay your take"}
        >
          <LineChart size={18} />
        </IconButton>
        <div className="exercise-transport-scrub">
          <input
            className="exercise-transport-slider"
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            onChange={(event) => onScrub(Number(event.target.value))}
            aria-label="Practice scrub"
            style={{ "--transport-progress": `${Math.round(progress * 100)}%` } as CSSProperties}
          />
          <p>{createTransportHint(status, mode)}</p>
        </div>
        {status === "retry" ? (
          <IconButton
            className="exercise-restart-action"
            size="lg"
            variant="toolbar"
            onClick={onPrimaryAction}
            disabled={isBusy}
            aria-label={primaryLabel}
            title={primaryLabel}
          >
            <RotateCcw size={24} strokeWidth={2.25} />
          </IconButton>
        ) : status === "passed" ? (
          <Button className="exercise-primary-action" variant="primary" size="lg" onClick={onAdvance}>
            <Play size={18} />
            <span>Move on</span>
          </Button>
        ) : (
          <Button
            className="exercise-primary-action"
            variant="primary"
            size="lg"
            onClick={onPrimaryAction}
            disabled={isBusy || status === "complete"}
            aria-label={primaryLabel}
            title={primaryLabel}
          >
            <Mic size={18} />
            <span>{primaryLabel}</span>
          </Button>
        )}
      </>
    );
  }

  const autoView = createAutoTransportView(status, statusView);
  const autoPillContent = (
    <>
      {autoView.pulse ? <span className="exercise-eq-bars" aria-hidden="true"><i /><i /><i /></span> : autoView.icon}
      <span>{autoView.label}</span>
      <small>{autoView.detail}</small>
    </>
  );

  return (
    <>
      <div className="exercise-auto-center">
        {isPaused ? (
          <button type="button" className="exercise-auto-pill exercise-auto-pill--success" onClick={onResume}>
            <Play size={16} fill="currentColor" />
            <span>Resume practice</span>
          </button>
        ) : status === "idle" ? (
          <button
            type="button"
            className={`exercise-auto-pill exercise-auto-pill--${autoView.tone}`}
            onClick={onPrimaryAction}
            aria-label={`${autoView.label}. ${autoView.detail}`}
          >
            {autoPillContent}
          </button>
        ) : (
          <div
            className={`exercise-auto-pill exercise-auto-pill--${autoView.tone}`}
            aria-live="polite"
          >
            {autoPillContent}
          </div>
        )}
      </div>
      <IconButton
        className="exercise-restart-action"
        size="lg"
        variant="toolbar"
        onClick={onRestart}
        disabled={isBusy}
        aria-label="Restart practice"
        title="Restart practice"
      >
        <RotateCcw size={24} strokeWidth={2.25} />
      </IconButton>
    </>
  );
}

function createPrimaryPracticeLabel(
  status: LessonStatus,
  exercise: ExerciseDefinition,
  mode: PracticeMode
) {
  if (status === "complete") {
    return "Reset lesson";
  }

  if (status === "retry") {
    return exercise.id === "major-triad" ? "Retry triad" : "Retry exercise";
  }

  return mode === "manual" ? "Sing it" : "Start lesson";
}

function createTransportHint(status: LessonStatus, mode: PracticeMode) {
  if (mode === "manual") {
    if (status === "promptPlaying") {
      return "Listening to the guide...";
    }
    if (status === "listening") {
      return "Listening to you...";
    }
    if (status === "retry") {
      return "Replay the guide or sing again";
    }
    if (status === "passed") {
      return "Clean take - move on when ready";
    }
    return "Drag to scrub · hear the guide, then sing";
  }

  return legacyStatusCopy[status];
}

function createMockCoachTitle(status: LessonStatus, mode: PracticeMode) {
  if (mode === "manual" && status === "idle") {
    return "Manual mode";
  }

  switch (status) {
    case "promptPlaying":
      return "Listen closely";
    case "awaitingVoice":
      return "Your turn";
    case "listening":
      return "Sing it back";
    case "scoring":
      return "Scoring locally";
    case "passed":
      return "Nice pass";
    case "retry":
      return "Try it again";
    case "complete":
      return "Lesson complete";
    case "idle":
      return "Ready";
  }
}

function createMockCoachMessage(
  guidance: CoachGuidanceView,
  status: LessonStatus,
  mode: PracticeMode
) {
  if (mode === "manual" && status === "idle") {
    return "Hear the guide, then sing whenever you're ready.";
  }

  if (status === "promptPlaying") {
    return "Root, third, then the fifth.";
  }

  return formatDisplayNoteName(guidance.message);
}

function formatKeyName(midi: number) {
  return formatDisplayNoteName(midiToNoteName(midi)).replace(/\d+$/, "");
}

function formatDisplayNoteName(label: string) {
  return label.replaceAll("#", "♯");
}

function NoteCheckpointStrip({
  targetSegments,
  attemptScore,
  activeSegmentIndices,
  guideActive
}: {
  targetSegments: TargetSegment[];
  attemptScore: AttemptScore | null;
  activeSegmentIndices: number[];
  guideActive: boolean;
}) {
  const segments = attemptScore?.segments ?? targetSegments.map((segment) => ({ ...segment, score: null }));

  return (
    <ol className="note-checkpoint-strip" aria-label="Target segments">
      {segments.map((segment, index) => {
        const status = segment.score?.status ?? "target";
        const displayStatus = guideActive ? "target" : status;
        const isActive = guideActive && activeSegmentIndices.includes(index);
        return (
          <li
            key={`${index}-${segment.id}`}
            className={`note-checkpoint note-checkpoint--${displayStatus}${isActive ? " note-checkpoint--active" : ""}`}
            aria-current={isActive ? "step" : undefined}
          >
            <span className="note-checkpoint__degree">{getCheckpointIcon(segment, displayStatus)}</span>
            <strong>{formatDisplayNoteName(describeTargetSegmentPitch(segment))}</strong>
            <span className="note-checkpoint__label">{describeCheckpointLabel(segment, displayStatus, index)}</span>
            <span className="checkpoint-status-legacy">{describeCheckpointStatus(displayStatus)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function getCheckpointIcon(segment: TargetSegment, status: SegmentAssessmentStatus | "target") {
  if (status === "pass" || status === "passWithWarning") {
    return <Check size={20} strokeWidth={3} aria-hidden="true" />;
  }

  return getCheckpointMarker(segment);
}

function formatTargetSegmentPattern(targetSegments: TargetSegment[]) {
  return targetSegments.map(describeTargetSegmentPitch).join(" - ");
}

function describeTargetSegmentPitch(segment: TargetSegment) {
  return segment.kind === "note"
    ? segment.noteName
    : `${segment.fromNoteName} to ${segment.toNoteName}`;
}

function getCheckpointMarker(segment: TargetSegment) {
  if (segment.kind === "glide") {
    return segment.shortLabel;
  }

  return formatScaleDegreeMarker(segment.offsetSemitones) ?? segment.shortLabel;
}

function formatScaleDegreeMarker(offsetSemitones: number) {
  const normalizedOffset = ((offsetSemitones % 12) + 12) % 12;
  if (offsetSemitones !== 0 && offsetSemitones % 12 === 0) {
    return "8";
  }

  const degreeByOffset: Record<number, string> = {
    0: "1",
    1: "2",
    2: "2",
    3: "3",
    4: "3",
    5: "4",
    6: "5",
    7: "5",
    8: "6",
    9: "6",
    10: "7",
    11: "7"
  };

  return degreeByOffset[normalizedOffset];
}

function describeCheckpointLabel(
  segment: TargetSegment,
  status: SegmentAssessmentStatus | "target",
  index: number
) {
  if (status !== "target") {
    return describeCheckpointStatus(status);
  }

  return segment.label || `Target ${index + 1}`;
}

function describeCheckpointStatus(status: SegmentAssessmentStatus | "target") {
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
    case "wrongDirection":
      return "Wrong way";
    case "offContour":
      return "Off line";
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
  practiceSummary,
  children
}: {
  activeScreen: TopLevelScreen;
  onNavigate: (screen: TopLevelScreen) => void;
  practiceSummary: ReturnType<typeof usePitchCoachController>["practiceSummary"];
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
          footer={<LocalSaveFooter practiceSummary={practiceSummary} />}
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
        <img className="shell-brand__logo" src={PITCH_COACH_LOGO_URL} alt="" />
      </span>
      <span className="shell-brand__name">Pitch Coach</span>
    </div>
  );
}

function LocalSaveFooter({
  practiceSummary
}: {
  practiceSummary: ReturnType<typeof usePitchCoachController>["practiceSummary"];
}) {
  return (
    <div className="shell-local-footer">
      <div className="shell-streak-card">
        <Flame size={22} aria-hidden="true" />
        <span>
          <strong>{formatDayCount(practiceSummary.streakDays)}</strong>
          <span>practice streak</span>
        </span>
      </div>
      <div className="shell-user-card">
        <span className="shell-user-avatar" aria-hidden="true">
          L
        </span>
        <span className="shell-user-copy">
          <strong>Local practice</strong>
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
  practiceSummary: ReturnType<typeof usePitchCoachController>["practiceSummary"];
  onSelectExercise: (exerciseId: ReturnType<typeof usePitchCoachController>["selectedExercise"]["id"]) => void;
  disabled: boolean;
};

type RangeSetupPromptProps = {
  range: CoachSettings["range"];
  rangeSetupStatus: CoachSettings["rangeSetup"]["status"];
  onOpenRangeSetup: () => void;
};

type PracticeLibraryScreenProps = LibraryScreenProps & RangeSetupPromptProps;

type HomeScreenProps = LibraryScreenProps &
  RangeSetupPromptProps & {
    practiceSummary: ReturnType<typeof usePitchCoachController>["practiceSummary"];
    recommendedExercise: ReturnType<typeof usePitchCoachController>["recommendedExercise"];
    onNavigateToPractice: () => void;
    onNavigateToSongs: () => void;
  };

function HomeScreen({
  exercises,
  exerciseProgress,
  practiceSummary,
  recommendedExercise,
  range,
  rangeSetupStatus,
  onOpenRangeSetup,
  onSelectExercise,
  onNavigateToPractice,
  onNavigateToSongs,
  disabled
}: HomeScreenProps) {
  const recommendedProgress = exerciseProgress[recommendedExercise.exercise.id];
  const completedExerciseCount = countExercisesTried(exercises, exerciseProgress);
  const exerciseCoveragePercent =
    exercises.length > 0 ? Math.round((completedExerciseCount / exercises.length) * 100) : 0;
  const hasRecommendedHistory = recommendedProgress.attemptCount > 0;
  const showRangeSetupPrompt = rangeSetupStatus !== "completed";

  return (
    <main
      className={`mock-home ${showRangeSetupPrompt ? "mock-home--with-range-prompt" : ""}`.trim()}
      aria-label="Pitch coach home"
    >
      <section className="mock-home__header">
        <div>
          <h1>Good evening</h1>
          <p>{createHomeIntroCopy(practiceSummary)}</p>
        </div>
        <WeeklyStreakSummary buckets={practiceSummary.weekActivity} />
      </section>

      <Card
        as="section"
        className="mock-resume-card"
        variant="mockSoft"
        padding="none"
        aria-label={hasRecommendedHistory ? "Pick up where you left off" : "Recommended practice"}
      >
        <div className="mock-resume-card__copy">
          <div className="mock-kicker">
            <Sparkles size={18} aria-hidden="true" />
            <span>{hasRecommendedHistory ? "Pick up where you left off" : "Recommended practice"}</span>
          </div>
          <div className="mock-resume-card__title-row">
            <h2>{recommendedExercise.exercise.title}</h2>
            <span>{createRecommendationMeta(recommendedExercise.exercise)}</span>
          </div>
          <p>{createRecommendationCopy(recommendedExercise.reason, recommendedProgress)}</p>
          <div className="mock-resume-card__actions">
            <button
              className="mock-primary-action"
              type="button"
              onClick={() => onSelectExercise(recommendedExercise.exercise.id)}
              disabled={disabled}
            >
              <Play size={17} fill="currentColor" aria-hidden="true" />
              <span>{hasRecommendedHistory ? "Resume practice" : "Start practice"}</span>
            </button>
            {hasRecommendedHistory && recommendedProgress.recentPassRate !== undefined ? (
              <span>
                <strong>{recommendedProgress.recentPassRate}%</strong>
                recent pass
              </span>
            ) : null}
          </div>
        </div>
        <ExercisePitchPreview exercise={recommendedExercise.exercise} />
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
              <span>{exercises.length} guided exercises · ear &amp; voice</span>
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
            <span
              style={
                {
                  "--practice-progress": `${exerciseCoveragePercent}%`
                } as CSSProperties
              }
            />
            <strong>
              {formatInteger(practiceSummary.attemptCount)}{" "}
              <span>{practiceSummary.attemptCount === 1 ? "attempt logged" : "attempts logged"}</span>
            </strong>
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
          value={formatInteger(practiceSummary.streakDays)}
          valueClassName="mock-stat-card__value--accent"
        />
        <StatCard
          className="mock-stat-card"
          variant="mock"
          padding="none"
          icon={<LineChart size={19} />}
          label="Accuracy"
          value={practiceSummary.segmentAccuracy ?? 0}
          unit="%"
          trend={<AccuracySparkline buckets={practiceSummary.weekActivity} />}
        />
        <StatCard
          className="mock-stat-card"
          variant="mock"
          padding="none"
          icon={<CheckCircle2 size={18} />}
          label="Targets in tune"
          value={formatInteger(practiceSummary.segmentsInTune)}
          valueClassName="mock-stat-card__value--green"
        />
        <StatCard
          className="mock-stat-card"
          variant="mock"
          padding="none"
          icon={<Clock3 size={18} />}
          label="Practiced"
          value={formatInteger(practiceSummary.practiceMinutes)}
          unit="min"
        />
      </section>
      {showRangeSetupPrompt ? <RangeSetupFloatingPrompt range={range} onOpen={onOpenRangeSetup} /> : null}
    </main>
  );
}

function countExercisesTried(
  exercises: ReturnType<typeof usePitchCoachController>["exercises"],
  exerciseProgress: ReturnType<typeof usePitchCoachController>["exerciseProgress"]
) {
  return exercises.filter((exercise) => exerciseProgress[exercise.id].attemptCount > 0).length;
}

function createHomeIntroCopy(
  practiceSummary: ReturnType<typeof usePitchCoachController>["practiceSummary"]
) {
  if (practiceSummary.streakDays > 0) {
    return `You’re on a ${practiceSummary.streakDays}-day roll — a few minutes keeps it alive.`;
  }

  if (practiceSummary.attemptCount > 0) {
    return `${formatAttemptCount(practiceSummary.attemptCount)} logged on this device.`;
  }

  return "Your local practice stats will build as you sing.";
}

function createRecommendationMeta(exercise: ExerciseDefinition) {
  return `${formatCategoryLabel(exercise.category)} · ${exercise.focus}`;
}

function createRecommendationCopy(
  fallbackReason: string,
  progress: ExerciseProgressSummary
) {
  if (progress.attemptCount === 0) {
    return fallbackReason;
  }

  if (progress.commonIssue) {
    return `${capitalizeFirst(describeIssue(progress.commonIssue))} showed up in recent attempts — let’s clean it up.`;
  }

  if (progress.recentPassRate !== undefined) {
    return `Recent pass rate is ${progress.recentPassRate}% — keep this drill in rotation.`;
  }

  return `${formatAttemptCount(progress.attemptCount)} logged — keep building the baseline.`;
}

function formatDayCount(days: number) {
  return `${formatInteger(days)} ${days === 1 ? "day" : "days"}`;
}

function formatAttemptCount(count: number) {
  return `${formatInteger(count)} ${count === 1 ? "attempt" : "attempts"}`;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0
  }).format(value);
}

function capitalizeFirst(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function WeeklyStreakSummary({
  buckets
}: {
  buckets: ReturnType<typeof usePitchCoachController>["practiceSummary"]["weekActivity"];
}) {
  return (
    <div className="mock-week-streak" aria-label="Weekly streak">
      {buckets.map((bucket) => {
        const done = bucket.attemptCount > 0;
        return (
        <span key={bucket.date} className="mock-week-streak__day">
          <span className={done ? "mock-week-streak__box is-done" : "mock-week-streak__box"}>
            {done ? <CheckIcon /> : null}
          </span>
          <span>{formatWeekday(bucket.date).slice(0, 1)}</span>
        </span>
        );
      })}
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

function ExercisePitchPreview({ exercise }: { exercise: ExerciseDefinition }) {
  const offsets = exercise.patternSegments.flatMap((segment) =>
    segment.kind === "note"
      ? [segment.offsetSemitones]
      : [segment.fromOffsetSemitones, segment.toOffsetSemitones]
  );
  const minOffset = Math.min(...offsets);
  const maxOffset = Math.max(...offsets);
  const range = Math.max(1, maxOffset - minOffset);
  const points = offsets.map((offset, index) => {
    const x = 40 + (index / Math.max(1, offsets.length - 1)) * 340;
    const y = 170 - ((offset - minOffset) / range) * 112;
    return { x, y };
  });
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const guide = points
    .map((point) => `M${Math.max(20, point.x - 24).toFixed(1)} ${point.y.toFixed(1)}H${Math.min(400, point.x + 24).toFixed(1)}`)
    .join(" ");

  return (
    <div className="mock-pitch-preview" aria-hidden="true">
      <svg viewBox="0 0 420 230" preserveAspectRatio="none">
        <path className="mock-pitch-preview__grid" d="M20 34H400M20 81H400M20 128H400M20 175H400" />
        <path className="mock-pitch-preview__guide" d={guide} />
        <path className="mock-pitch-preview__line" d={path} />
        {points.map((point, index) => (
          <circle
            key={`${point.x}-${index}`}
            className="mock-pitch-preview__dot"
            cx={point.x}
            cy={point.y}
            r="5"
          />
        ))}
      </svg>
    </div>
  );
}

function AccuracySparkline({
  buckets
}: {
  buckets: ReturnType<typeof usePitchCoachController>["practiceSummary"]["weekActivity"];
}) {
  const points = buckets.flatMap((bucket, index) => {
    if (bucket.segmentCount === 0) {
      return [];
    }

    const accuracy = bucket.segmentsInTune / bucket.segmentCount;
    const x = 5 + (index / Math.max(1, buckets.length - 1)) * 140;
    const y = 4 + (1 - accuracy) * 40;
    return [{ x, y }];
  });
  const path =
    points.length === 0
      ? "M5 35H145"
      : points
          .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
          .join(" ");

  return (
    <svg
      className={`mock-accuracy-sparkline ${points.length === 0 ? "is-empty" : ""}`.trim()}
      viewBox="0 0 150 48"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

function PracticeLibraryScreen({
  range,
  rangeSetupStatus,
  onOpenRangeSetup,
  ...libraryProps
}: PracticeLibraryScreenProps) {
  const showRangeSetupPrompt = rangeSetupStatus !== "completed";

  return (
    <main
      className={`mock-practice-page ${showRangeSetupPrompt ? "mock-practice-page--with-range-prompt" : ""}`.trim()}
      aria-label="Pitch coach exercises"
    >
      <ExerciseLibrary {...libraryProps} />
      {showRangeSetupPrompt ? <RangeSetupFloatingPrompt range={range} onOpen={onOpenRangeSetup} /> : null}
    </main>
  );
}

function RangeSetupFloatingPrompt({
  range,
  onOpen
}: {
  range: CoachSettings["range"];
  onOpen: () => void;
}) {
  return (
    <div className="range-prompt-floating">
      <RangeSetupToast range={range} onOpen={onOpen} />
    </div>
  );
}

type ProgressScreenProps = {
  exercises: ReturnType<typeof usePitchCoachController>["exercises"];
  exerciseProgress: ReturnType<typeof usePitchCoachController>["exerciseProgress"];
  practiceSummary: ReturnType<typeof usePitchCoachController>["practiceSummary"];
  recentSessions: ReturnType<typeof usePitchCoachController>["recentSessions"];
  onSelectExercise: (exerciseId: ReturnType<typeof usePitchCoachController>["selectedExercise"]["id"]) => void;
};

function ProgressScreen({
  exercises,
  exerciseProgress,
  practiceSummary,
  recentSessions,
  onSelectExercise
}: ProgressScreenProps) {
  const exercisesDone = countExercisesTried(exercises, exerciseProgress);
  const accuracyTrend = createAccuracyTrend(recentSessions);
  const sessionItems = createProgressSessionItems(recentSessions, exercises);

  return (
    <main className="mock-progress-page" aria-label="Pitch coach progress">
      <header className="mock-progress-page__header">
        <h1>Your Progress</h1>
        <p>Saved on this device — keep the streak alive.</p>
      </header>

      <section className="progress-metric-grid" aria-label="Progress summary">
        <ProgressMetricCard
          icon={<Flame size={17} aria-hidden="true" />}
          label="Day streak"
          value={formatInteger(practiceSummary.streakDays)}
          valueTone="accent"
        />
        <ProgressMetricCard
          icon={<Check size={17} aria-hidden="true" />}
          label="Targets in tune"
          value={formatInteger(practiceSummary.segmentsInTune)}
          valueTone="green"
        />
        <ProgressMetricCard
          icon={<Target size={17} aria-hidden="true" />}
          label="Exercises done"
          value={formatInteger(exercisesDone)}
        />
        <ProgressMetricCard
          icon={<Clock3 size={17} aria-hidden="true" />}
          label="Time practiced"
          value={formatInteger(practiceSummary.practiceMinutes)}
          unit="min"
        />
      </section>

      <section className="progress-main-grid" aria-label="Progress details">
        <div className="progress-left-stack">
          <ProgressAccuracyCard
            accuracy={practiceSummary.segmentAccuracy}
            trend={accuracyTrend}
          />
          <ProgressWeekCard
            buckets={practiceSummary.weekActivity}
            streakDays={practiceSummary.streakDays}
          />
        </div>

        <ProgressRecentSessionsCard items={sessionItems} onSelectExercise={onSelectExercise} />
      </section>
    </main>
  );
}

function ProgressMetricCard({
  icon,
  label,
  value,
  unit,
  valueTone = "default"
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  valueTone?: "default" | "accent" | "green";
}) {
  return (
    <StatCard
      className="mock-stat-card progress-metric-card"
      variant="mock"
      padding="none"
      icon={icon}
      label={label}
      value={value}
      unit={unit}
      valueClassName={
        valueTone === "accent"
          ? "mock-stat-card__value--accent"
          : valueTone === "green"
            ? "mock-stat-card__value--green"
            : ""
      }
    />
  );
}

function ProgressAccuracyCard({
  accuracy,
  trend
}: {
  accuracy?: number;
  trend: number[];
}) {
  return (
    <Card className="progress-panel progress-accuracy-panel" variant="mock" padding="none">
      <div className="progress-accuracy-panel__header">
        <div>
          <h2>Accuracy over time</h2>
          <p>last 10 sessions</p>
        </div>
        <div className="progress-accuracy-summary">
          <strong>{accuracy === undefined ? "New" : `${accuracy}%`}</strong>
          <span className={getAccuracyDeltaClassName(trend)}>{formatAccuracyDelta(trend)}</span>
        </div>
      </div>
      <ProgressAccuracyChart data={trend} />
    </Card>
  );
}

function ProgressAccuracyChart({ data }: { data: number[] }) {
  const width = 560;
  const height = 150;
  const chartData =
    data.length === 0
      ? []
      : data.length === 1
        ? [data[0], data[0]]
        : data;
  const minValue = chartData.length === 0 ? 0 : Math.max(0, Math.min(...chartData) - 3);
  const maxValue = chartData.length === 0 ? 100 : Math.min(100, Math.max(...chartData) + 2);
  const range = Math.max(1, maxValue - minValue);
  const points = chartData.map((value, index) => ({
    x: (index / Math.max(1, chartData.length - 1)) * width,
    y: height - 14 - ((value - minValue) / range) * (height - 28)
  }));
  const linePath =
    points.length === 0
      ? `M0 ${height - 42}H${width}`
      : createSmoothPath(points);
  const areaPath =
    points.length === 0
      ? ""
      : `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="progress-accuracy-chart" aria-label="Accuracy trend">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="progressAccuracyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--mock-green)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--mock-green)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[25, 50, 75].map((percent) => {
          const y = height - 14 - (percent / 100) * (height - 28);
          return <line key={percent} x1="0" x2={width} y1={y} y2={y} />;
        })}
        {areaPath ? <path className="progress-accuracy-chart__area" d={areaPath} /> : null}
        <path
          className={`progress-accuracy-chart__line ${points.length === 0 ? "is-empty" : ""}`.trim()}
          d={linePath}
        />
        {points.map((point, index) => (
          <circle
            key={`${point.x}-${point.y}`}
            cx={point.x}
            cy={point.y}
            r={index === points.length - 1 ? 5 : 3}
          />
        ))}
      </svg>
      {data.length === 0 ? <span>No accuracy yet</span> : null}
    </div>
  );
}

function ProgressWeekCard({
  buckets,
  streakDays
}: {
  buckets: ReturnType<typeof usePitchCoachController>["practiceSummary"]["weekActivity"];
  streakDays: number;
}) {
  return (
    <Card className="progress-panel progress-week-panel" variant="mock" padding="none">
      <h2>This week</h2>
      <div className="progress-week-content">
        <div className="progress-week-strip" aria-label="This week">
          {buckets.map((bucket) => {
            const done = bucket.attemptCount > 0;
            return (
              <span key={bucket.date} className="progress-week-day">
                <span className={`progress-week-box ${done ? "is-done" : ""}`.trim()}>
                  {done ? <CheckIcon /> : null}
                </span>
                <span>{formatWeekday(bucket.date).slice(0, 1)}</span>
              </span>
            );
          })}
        </div>
        <div className="progress-week-streak">
          <Flame size={24} aria-hidden="true" />
          <strong>{formatDayCount(streakDays)} streak</strong>
        </div>
      </div>
    </Card>
  );
}

type ProgressSessionItemView = {
  id: string;
  exerciseId: ExerciseId;
  href: string;
  title: string;
  meta: string;
  score: number;
  tone: "good" | "needs-work";
};

function ProgressRecentSessionsCard({
  items,
  onSelectExercise
}: {
  items: ProgressSessionItemView[];
  onSelectExercise: (exerciseId: ExerciseId) => void;
}) {
  return (
    <Card className="progress-panel progress-recent-panel" variant="mock" padding="none">
      <h2>Recent sessions</h2>
      {items.length === 0 ? (
        <p className="progress-empty-copy">Complete a guided exercise and recent sessions will appear here.</p>
      ) : (
        <ol className="progress-session-list">
          {items.map((item) => (
            <ProgressSessionItem key={item.id} item={item} onSelectExercise={onSelectExercise} />
          ))}
        </ol>
      )}
    </Card>
  );
}

function ProgressSessionItem({
  item,
  onSelectExercise
}: {
  item: ProgressSessionItemView;
  onSelectExercise: (exerciseId: ExerciseId) => void;
}) {
  return (
    <li className="progress-session-item">
      <a
        className="progress-session-link"
        href={item.href}
        onClick={(event) => {
          event.preventDefault();
          onSelectExercise(item.exerciseId);
        }}
      >
        <span className={`progress-session-item__icon is-${item.tone}`} aria-hidden="true">
          <Target size={18} />
        </span>
        <span className="progress-session-item__copy">
          <strong>{item.title}</strong>
          <span>{item.meta}</span>
        </span>
        <strong className={`progress-session-item__score is-${item.tone}`}>{item.score}%</strong>
      </a>
    </li>
  );
}

function createProgressSessionItems(
  sessions: ReturnType<typeof usePitchCoachController>["recentSessions"],
  exercises: ReturnType<typeof usePitchCoachController>["exercises"]
): ProgressSessionItemView[] {
  return sessions.slice(0, 5).map((session) => {
    const exercise = exercises.find((candidate) => candidate.id === session.exerciseId);
    const score = session.segmentAccuracy;
    return {
      id: session.id,
      exerciseId: session.exerciseId,
      href: routePath({ screen: "practice", exerciseId: session.exerciseId }),
      title: exercise?.title ?? getExerciseTitle(exercises, session.exerciseId),
      meta: `${exercise ? formatCategoryLabel(exercise.category) : "Exercise"} · ${formatAttemptCount(
        session.attemptCount
      )} · ${formatProgressSessionDate(session.lastAttemptAt)}`,
      score,
      tone: score >= 80 ? "good" : "needs-work"
    };
  });
}

function createAccuracyTrend(sessions: ReturnType<typeof usePitchCoachController>["recentSessions"]) {
  return sessions
    .slice(0, 10)
    .reverse()
    .map((session) => session.segmentAccuracy);
}

function formatAccuracyDelta(trend: number[]) {
  if (trend.length === 0) {
    return "No sessions yet";
  }

  const delta = trend.at(-1)! - trend[0];
  if (delta > 0) {
    return `▲ ${delta} since you started`;
  }
  if (delta < 0) {
    return `▼ ${Math.abs(delta)} since you started`;
  }
  return "0 since you started";
}

function getAccuracyDeltaClassName(trend: number[]) {
  if (trend.length < 2) {
    return "is-neutral";
  }

  return trend.at(-1)! >= trend[0] ? "is-positive" : "is-negative";
}

function createSmoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) {
    return "";
  }

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    }

    const previous = points[index - 1];
    const controlX = previous.x + (point.x - previous.x) / 2;
    return `${path} C${controlX.toFixed(1)} ${previous.y.toFixed(1)}, ${controlX.toFixed(1)} ${point.y.toFixed(
      1
    )}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }, "");
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
  practiceSummary: ReturnType<typeof usePitchCoachController>["practiceSummary"];
  onSelectExercise: (exerciseId: ReturnType<typeof usePitchCoachController>["selectedExercise"]["id"]) => void;
  disabled: boolean;
};

type ExerciseCategoryFilter = "all" | ExerciseCategory;

const exerciseCategoryFilters: readonly ExerciseCategoryFilter[] = [
  "all",
  "pitch",
  "interval",
  "arpeggio",
  "scale",
  "glide"
];

type PracticeExerciseDisplay = {
  keyLabel: string;
  completedCount: number;
  accuracy: number | null;
  difficulty: 1 | 2 | 3;
};

function ExerciseLibrary({
  exercises,
  selectedExerciseId,
  exerciseProgress,
  practiceSummary,
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
            <b>{completedExerciseCount}</b> / {exercises.length} exercises tried · keep your ear &amp; voice sharp
          </p>
        </div>
        <div
          className="library-heading__stat"
          aria-label={
            practiceSummary.segmentAccuracy === undefined
              ? "No accuracy yet"
              : `${practiceSummary.segmentAccuracy}% accuracy`
          }
        >
          <LineChart size={16} aria-hidden="true" />
          <strong>{practiceSummary.segmentAccuracy === undefined ? "New" : `${practiceSummary.segmentAccuracy}%`}</strong>
          <span className="library-heading__spark">
            <AccuracySparkline buckets={practiceSummary.weekActivity} />
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
  const recentAccuracy = progress.recentPassRate ?? null;
  const difficulty = Math.min(3, Math.max(1, Math.ceil(exercise.difficulty / 2))) as 1 | 2 | 3;

  return {
    keyLabel: exercise.focus,
    completedCount: progress.attemptCount,
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
    case "glide":
      return <TrendingUp size={17} strokeWidth={1.7} />;
  }
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
    case "glide":
      return "Slides";
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
  return `${formatAttemptCount(progress.attemptCount)} logged · ${progress.recentPassRate}% recent pass · ${formatLastPracticed(
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

function formatProgressSessionDate(createdAt: string) {
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) {
    return "Unknown time";
  }

  const date = new Date(timestamp);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const elapsedDays = Math.round((todayStart - dateStart) / 86400000);
  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });

  if (elapsedDays === 0) {
    return `Today · ${time}`;
  }
  if (elapsedDays === 1) {
    return "Yesterday";
  }
  if (elapsedDays > 1 && elapsedDays < 7) {
    return `${elapsedDays} days ago`;
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric"
  });
}

function describeIssue(status: SegmentAssessmentStatus) {
  switch (status) {
    case "flat":
      return "flat";
    case "sharp":
      return "sharp";
    case "wrongNote":
      return "wrong note";
    case "wrongDirection":
      return "wrong direction";
    case "offContour":
      return "off contour";
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
