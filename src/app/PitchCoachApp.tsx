import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Gauge,
  History,
  Mic2,
  Monitor,
  Moon,
  Music2,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Sun,
  Trash2,
  Volume2
} from "lucide-react";
import { Dropdown, type DropdownOption } from "../components/Dropdown";
import { FeedbackList } from "../components/FeedbackList";
import { PitchTimeline } from "../components/PitchTimeline";
import type {
  ExerciseId,
  ExerciseProgressSummary,
  NoteAssessmentStatus,
  ThemePreference
} from "../domain/contracts";
import { isExerciseId } from "../domain/exercise";
import { midiToNoteName } from "../domain/music";
import { SongPracticeScreen } from "../song/SongPracticeScreen";
import type { SongModeServices } from "../song/types";
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
  const resolvedTheme = usePitchCoachTheme(coach.settings.themePreference);

  useEffect(() => {
    if (
      router.route.screen === "practice" &&
      router.route.exerciseId !== coach.selectedExercise.id
    ) {
      coach.selectExercise(router.route.exerciseId);
    }
  }, [coach.selectedExercise.id, coach.selectExercise, router.route]);

  useEffect(() => {
    if (router.route.screen === "library") {
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

  if (router.route.screen === "library") {
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
                <span className="readout-label">Selected</span>
                <strong>{coach.selectedExercise.title}</strong>
              </div>
              <button
                className="text-action mode-action"
                type="button"
                onClick={() => router.navigateToSongs()}
              >
                <Music2 size={16} />
                <span>Song mode</span>
              </button>
            </div>
          </header>

          <ExerciseLibrary
            exercises={coach.exercises}
            selectedExerciseId={coach.selectedExercise.id}
            exerciseProgress={coach.exerciseProgress}
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
  const exerciseOptions = coach.exercises.map((exercise) => ({
    value: exercise.id,
    label: exercise.title
  })) satisfies DropdownOption<(typeof coach.exercises)[number]["id"]>[];
  const noteOptions = coach.noteOptions.map((note) => ({
    value: note.midi,
    label: note.label
  })) satisfies DropdownOption<number>[];

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

            <PitchTimeline
              frames={coach.pitchFrames}
              targetNotes={coach.targetNotes}
              attemptScore={coach.attemptScore}
              totalDurationMs={coach.listeningDurationMs}
              toleranceCents={coach.settings.toleranceCents}
              status={coach.lessonState.status}
              theme={resolvedTheme}
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
              <button
                className="text-action"
                type="button"
                onClick={() => {
                  if (window.confirm("Clear all local attempt history?")) {
                    void coach.clearLocalAttemptHistory();
                  }
                }}
                disabled={coach.attemptHistoryCount === 0}
              >
                <Trash2 size={16} />
                <span>Clear history</span>
              </button>
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

type ResolvedTheme = "light" | "dark";

const themeOptions = [
  {
    value: "system",
    label: "System",
    icon: Monitor
  },
  {
    value: "light",
    label: "Light",
    icon: Sun
  },
  {
    value: "dark",
    label: "Dark",
    icon: Moon
  }
] satisfies readonly {
  value: ThemePreference;
  label: string;
  icon: typeof Monitor;
}[];

function usePitchCoachTheme(themePreference: ThemePreference): ResolvedTheme {
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());
  const resolvedTheme = themePreference === "system" ? systemTheme : themePreference;

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => setSystemTheme(mediaQuery.matches ? "dark" : "light");
    updateSystemTheme();

    mediaQuery.addEventListener("change", updateSystemTheme);
    return () => mediaQuery.removeEventListener("change", updateSystemTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  return resolvedTheme;
}

function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
}

function ThemePicker({
  value,
  onValueChange
}: {
  value: ThemePreference;
  onValueChange: (themePreference: ThemePreference) => void;
}) {
  return (
    <div className="theme-picker" role="radiogroup" aria-label="Theme">
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            className={`theme-option${isSelected ? " theme-option-active" : ""}`}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${option.label} theme`}
            title={`${option.label} theme`}
            onClick={() => onValueChange(option.value)}
          >
            <Icon size={16} />
            <span className="visually-hidden">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function formatClipDuration(durationMs: number) {
  return `${Math.max(0, durationMs / 1000).toFixed(1)}s`;
}

type AppRoute =
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
    };

type RouteLocation =
  | {
      screen: "library";
    }
  | {
      screen: "practice";
      exerciseId: ExerciseId;
    }
  | {
      screen: "songs";
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
        window.history.replaceState(createHistoryState(false), "", routePath({ screen: "library" }));
        setRoute({
          screen: "library",
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

  const goBackToLibraryFallback = useCallback(() => {
    if ((route.screen === "practice" || route.screen === "songs") && route.fromAppNavigation) {
      window.history.back();
      return;
    }

    navigateToLibrary({ replace: true });
  }, [navigateToLibrary, route]);

  return {
    route,
    navigateToLibrary,
    navigateToExercise,
    navigateToSongs,
    goBackToLibraryFallback
  };
}

function readCurrentRoute(): AppRoute {
  const parsed = parsePathname(window.location.pathname);
  if (parsed.invalid) {
    return {
      screen: "library",
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

  const exerciseMatch = appPathname.match(/^\/exercises\/([^/]+)\/?$/);
  if (!exerciseMatch) {
    return {
      route: { screen: "library" },
      invalid: true
    };
  }

  let exerciseId: string;
  try {
    exerciseId = decodeURIComponent(exerciseMatch[1]);
  } catch {
    return {
      route: { screen: "library" },
      invalid: true
    };
  }

  if (!isExerciseId(exerciseId)) {
    return {
      route: { screen: "library" },
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
    route.screen === "library" ? "/" : route.screen === "songs" ? "/songs" : `/exercises/${route.exerciseId}`;
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
