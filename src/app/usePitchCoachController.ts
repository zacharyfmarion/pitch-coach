import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AttemptHistoryRecord,
  AttemptScore,
  CoachSettings,
  ExerciseId,
  PitchFrame,
  PracticeSessionRecord,
  VocalRange,
  VocalRangeSetupSource
} from "../domain/contracts";
import {
  buildTargetNotes,
  createNoteOptions,
  createScoringPolicy,
  EXERCISES,
  formatExercisePattern,
  getExerciseById,
  normalizeRange
} from "../domain/exercise";
import {
  advanceAfterPass,
  beginAwaitingVoice,
  beginListening,
  beginScoring,
  createLessonState,
  getCurrentRootMidi,
  resolveAttempt,
  startPrompt
} from "../domain/lessonMachine";
import { frequencyToMidi, midiToFrequency, midiToNoteName } from "../domain/music";
import {
  createAttemptHistoryRecord,
  createPracticeSessionRecord,
  getRecentAttemptsForExercise,
  getRecentPracticeAttempts,
  getRecentPracticeSessions,
  recommendPracticeExercise,
  pruneAttemptHistory,
  summarizePracticeHistory,
  summarizeExerciseProgress,
  updatePracticeSessionAfterAttempt
} from "../domain/progress";
import { isPitchFirstAttemptComplete, scoreAttempt } from "../domain/scoring";
import type { CapturedAudioClip } from "../audio/types";
import { createPitchCoachServices, type PitchCoachServices } from "../audio/services";
import {
  clearAttemptHistory,
  loadAttemptHistory,
  loadPracticeSessions,
  savePracticeSessionRecord,
  saveAttemptHistoryRecord
} from "../storage/attemptHistoryStorage";
import {
  deleteLatestAttemptClip,
  loadLatestAttemptClip,
  saveLatestAttemptClip
} from "../storage/clipStorage";
import { loadSettings, normalizeSettings, saveSettings } from "../storage/settingsStorage";
import {
  normalizeSetupRange,
  VOCAL_RANGE_MAX_MIDI,
  VOCAL_RANGE_MIN_MIDI
} from "../domain/vocalRange";

const PASS_ADVANCE_DELAY_MS = 900;
const VOICE_START_RMS = 0.006;
const MAX_RENDERED_FRAMES = 1000;
const RANGE_CAPTURE_MIN_DURATION_MS = 900;

export type RangeCaptureTarget = "low" | "high";

export type RangeCaptureState =
  | {
      status: "idle";
    }
  | {
      status: "listening";
      target: RangeCaptureTarget;
      latestMidi?: number;
    }
  | {
      status: "captured";
      target: RangeCaptureTarget;
      latestMidi: number;
      capturedMidi: number;
    }
  | {
      status: "error";
      target?: RangeCaptureTarget;
      errorMessage: string;
    };

export type PitchCoachControllerOptions = {
  services?: PitchCoachServices;
  initialSettings?: CoachSettings;
  initialExerciseId?: ExerciseId;
};

export type LocalClipView = {
  url: string;
  createdAt: string;
  durationMs: number;
};

export function usePitchCoachController(options: PitchCoachControllerOptions = {}) {
  const services = useMemo(() => options.services ?? createPitchCoachServices(), [options.services]);
  const [settings, setSettingsState] = useState<CoachSettings>(() => {
    const loadedSettings = normalizeSettings(options.initialSettings ?? loadSettings());
    if (!options.initialExerciseId) {
      return loadedSettings;
    }

    const exercise = getExerciseById(options.initialExerciseId);
    return normalizeSettings({
      ...loadedSettings,
      exerciseId: options.initialExerciseId,
      tempoBpm: exercise.defaultTempoBpm
    });
  });
  const selectedExercise = useMemo(() => getExerciseById(settings.exerciseId), [settings.exerciseId]);
  const [lessonState, setLessonState] = useState(() =>
    createLessonState(getExerciseById(settings.exerciseId), settings.range)
  );
  const [pitchFrames, setPitchFrames] = useState<PitchFrame[]>([]);
  const [attemptScore, setAttemptScore] = useState<AttemptScore | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [queuedAutoStart, setQueuedAutoStart] = useState(false);
  const [localClip, setLocalClip] = useState<LocalClipView | null>(null);
  const [clipErrorMessage, setClipErrorMessage] = useState<string | null>(null);
  const [attemptHistory, setAttemptHistory] = useState<AttemptHistoryRecord[]>([]);
  const [practiceSessions, setPracticeSessions] = useState<PracticeSessionRecord[]>([]);
  const [rangeCaptureState, setRangeCaptureState] = useState<RangeCaptureState>({ status: "idle" });

  const runIdRef = useRef(0);
  const activeSessionRef = useRef<PracticeSessionRecord | null>(null);
  const framesRef = useRef<PitchFrame[]>([]);
  const voiceStartMsRef = useRef<number | null>(null);
  const lastCompletionCheckMsRef = useRef(0);
  const finishStartedRef = useRef(false);
  const pendingClipRef = useRef<CapturedAudioClip | null>(null);
  const localClipUrlRef = useRef<string | null>(null);
  const lessonStateRef = useRef(lessonState);
  const listeningTimerRef = useRef<number | null>(null);
  const passTimerRef = useRef<number | null>(null);
  const rangeCaptureMidisRef = useRef<number[]>([]);

  const currentRootMidi = getCurrentRootMidi(lessonState) ?? selectedExercise.startRootMidi;
  const targetNotes = useMemo(
    () => buildTargetNotes(currentRootMidi, selectedExercise, settings.tempoBpm),
    [currentRootMidi, selectedExercise, settings.tempoBpm]
  );
  const noteOptions = useMemo(() => createNoteOptions(), []);
  const scoringPolicy = useMemo(() => createScoringPolicy(settings), [settings]);
  const exerciseProgress = useMemo(
    () => summarizeExerciseProgress(attemptHistory, EXERCISES),
    [attemptHistory]
  );
  const practiceSummary = useMemo(
    () => summarizePracticeHistory(attemptHistory, EXERCISES),
    [attemptHistory]
  );
  const recommendedExercise = useMemo(
    () => recommendPracticeExercise(attemptHistory, EXERCISES, selectedExercise.id),
    [attemptHistory, selectedExercise.id]
  );
  const selectedExerciseHistory = useMemo(
    () => getRecentAttemptsForExercise(attemptHistory, selectedExercise.id),
    [attemptHistory, selectedExercise.id]
  );
  const recentAttempts = useMemo(
    () => getRecentPracticeAttempts(attemptHistory),
    [attemptHistory]
  );
  const recentSessions = useMemo(
    () => getRecentPracticeSessions(practiceSessions, attemptHistory),
    [attemptHistory, practiceSessions]
  );
  const timelineDurationMs = useMemo(() => {
    const latestFrameMs = pitchFrames.at(-1)?.timeMs ?? 0;
    return Math.min(
      scoringPolicy.attemptMaxDurationMs,
      Math.max(attemptScore?.durationMs ?? 0, latestFrameMs + 1000, 2600)
    );
  }, [attemptScore?.durationMs, pitchFrames, scoringPolicy.attemptMaxDurationMs]);

  useEffect(() => {
    lessonStateRef.current = lessonState;
  }, [lessonState]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    void loadLatestAttemptClip()
      .then((clip) => {
        if (cancelled || !clip) {
          return;
        }
        setLocalClipFromBlob(clip);
      })
      .catch(() => setClipErrorMessage("Could not load the latest local clip."));

    return () => {
      cancelled = true;
      revokeLocalClipUrl();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadAttemptHistory(), loadPracticeSessions()]).then(([history, sessions]) => {
      if (cancelled) {
        return;
      }

      setAttemptHistory((current) => mergeAttemptHistory(current, history));
      setPracticeSessions((current) => mergePracticeSessions(current, sessions));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const clearListeningTimer = useCallback(() => {
    if (listeningTimerRef.current !== null) {
      window.clearTimeout(listeningTimerRef.current);
      listeningTimerRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    clearListeningTimer();
    if (passTimerRef.current !== null) {
      window.clearTimeout(passTimerRef.current);
      passTimerRef.current = null;
    }
  }, [clearListeningTimer]);

  useEffect(
    () => () => {
      runIdRef.current += 1;
      clearTimers();
      services.promptPlayer.cancel();
      void services.audioEngine.stop();
    },
    [clearTimers, services]
  );

  const setSettings = useCallback((nextSettings: CoachSettings) => {
    setSettingsState(normalizeSettings(nextSettings));
  }, []);

  const selectExercise = useCallback((exerciseId: ExerciseId) => {
    const exercise = getExerciseById(exerciseId);
    setSettingsState((current) =>
      normalizeSettings({
        ...current,
        exerciseId,
        tempoBpm: exercise.defaultTempoBpm
      })
    );
  }, []);

  const startPracticeSession = useCallback((exerciseId: ExerciseId) => {
    if (activeSessionRef.current?.exerciseId === exerciseId) {
      return;
    }

    activeSessionRef.current = createPracticeSessionRecord({ exerciseId });
  }, []);

  const endPracticeSession = useCallback((exerciseId?: ExerciseId) => {
    if (!exerciseId || activeSessionRef.current?.exerciseId === exerciseId) {
      activeSessionRef.current = null;
    }
  }, []);

  const finishAttempt = useCallback(
    async (runId: number, attemptTargets = targetNotes, attemptRootMidi = currentRootMidi) => {
      if (runId !== runIdRef.current || finishStartedRef.current) {
        return;
      }

      finishStartedRef.current = true;
      clearListeningTimer();
      setLessonState((current) => beginScoring(current));
      await services.audioEngine.stop();

      const score = scoreAttempt(framesRef.current, attemptTargets, scoringPolicy, settings.range);
      setAttemptScore(score);
      const practiceSession = getOrCreateActivePracticeSession(selectedExercise.id);
      const historyRecord = createAttemptHistoryRecord({
        sessionId: practiceSession.id,
        exerciseId: selectedExercise.id,
        rootMidi: attemptRootMidi,
        tempoBpm: settings.tempoBpm,
        toleranceCents: settings.toleranceCents,
        score
      });
      await persistPracticeSession(updatePracticeSessionAfterAttempt(practiceSession, historyRecord));
      await persistAttemptHistory(historyRecord);
      await persistPendingClip(score);
      setLessonState((current) => resolveAttempt(current, score));

      if (score.passed) {
        passTimerRef.current = window.setTimeout(() => {
          const advanced = advanceAfterPass(lessonStateRef.current);
          passTimerRef.current = null;
          setLessonState(advanced);
          if (advanced.status === "idle") {
            setQueuedAutoStart(true);
          }
        }, PASS_ADVANCE_DELAY_MS);
      }
    },
    [
      clearListeningTimer,
      currentRootMidi,
      scoringPolicy,
      services.audioEngine,
      selectedExercise.id,
      settings.range,
      settings.saveLocalClips,
      settings.tempoBpm,
      settings.toleranceCents,
      targetNotes
    ]
  );

  const startAttempt = useCallback(async () => {
    const rootMidi = getCurrentRootMidi(lessonStateRef.current);
    if (rootMidi === null) {
      setErrorMessage("Your range is too narrow for this exercise.");
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    clearTimers();
    setErrorMessage(null);
    setAttemptScore(null);
    framesRef.current = [];
    voiceStartMsRef.current = null;
    lastCompletionCheckMsRef.current = 0;
    finishStartedRef.current = false;
    pendingClipRef.current = null;
    setPitchFrames([]);

    const attemptTargets = buildTargetNotes(rootMidi, selectedExercise, settings.tempoBpm);
    const bounds = {
      minFrequencyHz: midiToFrequency(settings.range.lowestMidi),
      maxFrequencyHz: midiToFrequency(settings.range.highestMidi)
    };

    try {
      setLessonState((current) => startPrompt(current));
      await services.promptPlayer.playPrompt(
        attemptTargets,
        settings.tempoBpm,
        selectedExercise.promptStyle
      );
      if (runId !== runIdRef.current) {
        return;
      }

      setLessonState((current) => beginAwaitingVoice(current));
      await services.audioEngine.startCapture({
        detector: services.detector,
        bounds,
        captureAudioClip: settings.saveLocalClips,
        onAudioClip: (clip) => {
          pendingClipRef.current = clip;
        },
        onPitchFrame: (frame) => {
          if (runId !== runIdRef.current) {
            return;
          }

          if (voiceStartMsRef.current === null) {
            if (!isVoiceStartFrame(frame)) {
              return;
            }

            voiceStartMsRef.current = frame.timeMs;
            setLessonState((current) => beginListening(current));
            listeningTimerRef.current = window.setTimeout(
              () => void finishAttempt(runId, attemptTargets, rootMidi),
              scoringPolicy.attemptMaxDurationMs
            );
          }

          const alignedFrame = {
            ...frame,
            timeMs: frame.timeMs - voiceStartMsRef.current
          };
          framesRef.current.push(alignedFrame);
          setPitchFrames((current) => [...current.slice(-(MAX_RENDERED_FRAMES - 1)), alignedFrame]);

          if (
            !finishStartedRef.current &&
            alignedFrame.timeMs - lastCompletionCheckMsRef.current >= 160
          ) {
            lastCompletionCheckMsRef.current = alignedFrame.timeMs;
            if (
              isPitchFirstAttemptComplete(
                framesRef.current,
                attemptTargets,
                scoringPolicy,
                settings.range
              )
            ) {
              void finishAttempt(runId, attemptTargets, rootMidi);
            }
          }
        }
      });
    } catch (error) {
      if (runId !== runIdRef.current) {
        return;
      }

      await services.audioEngine.stop();
      setLessonState((current) => ({ ...current, status: "idle" }));
      setErrorMessage(createAudioErrorMessage(error));
    }
  }, [
    clearTimers,
    finishAttempt,
    scoringPolicy,
    services,
    selectedExercise,
    settings.range,
    settings.saveLocalClips,
    settings.tempoBpm
  ]);

  useEffect(() => {
    if (!queuedAutoStart || lessonState.status !== "idle") {
      return;
    }

    setQueuedAutoStart(false);
    void startAttempt();
  }, [lessonState.status, queuedAutoStart, startAttempt]);

  const stopAttempt = useCallback(async () => {
    runIdRef.current += 1;
    clearTimers();
    services.promptPlayer.cancel();
    await services.audioEngine.stop();
    voiceStartMsRef.current = null;
    lastCompletionCheckMsRef.current = 0;
    finishStartedRef.current = false;
    pendingClipRef.current = null;
    setLessonState((current) => ({ ...current, status: "idle" }));
    setRangeCaptureState((current) => (current.status === "listening" ? { status: "idle" } : current));
  }, [clearTimers, services]);

  const saveRangeSetup = useCallback((range: VocalRange, source: VocalRangeSetupSource) => {
    const normalizedRange = normalizeRange(normalizeSetupRange(range));
    setSettingsState((current) =>
      normalizeSettings({
        ...current,
        range: normalizedRange,
        rangeSetup: {
          status: "completed",
          source,
          completedAt: new Date().toISOString()
        }
      })
    );
  }, []);

  const skipRangeSetup = useCallback(() => {
    const skippedAt = new Date().toISOString();
    setSettingsState((current) =>
      normalizeSettings({
        ...current,
        rangeSetup: {
          status: "skipped",
          source: "default",
          skippedAt,
          lastPromptedAt: skippedAt
        }
      })
    );
  }, []);

  const stopRangeCapture = useCallback(async () => {
    runIdRef.current += 1;
    rangeCaptureMidisRef.current = [];
    await services.audioEngine.stop();
    setRangeCaptureState({ status: "idle" });
  }, [services.audioEngine]);

  const startRangeCapture = useCallback(
    async (target: RangeCaptureTarget) => {
      await stopAttempt();
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      rangeCaptureMidisRef.current = [];
      setRangeCaptureState({ status: "listening", target });

      try {
        await services.audioEngine.startCapture({
          detector: services.detector,
          bounds: {
            minFrequencyHz: midiToFrequency(VOCAL_RANGE_MIN_MIDI),
            maxFrequencyHz: midiToFrequency(VOCAL_RANGE_MAX_MIDI)
          },
          onPitchFrame: (frame) => {
            if (runId !== runIdRef.current || frame.frequencyHz === null || frame.rms < VOICE_START_RMS) {
              return;
            }

            const latestMidi = Math.round(frequencyToMidi(frame.frequencyHz));
            rangeCaptureMidisRef.current.push(latestMidi);
            setRangeCaptureState({ status: "listening", target, latestMidi });

            if (frame.timeMs < RANGE_CAPTURE_MIN_DURATION_MS) {
              return;
            }

            const capturedMidi =
              target === "low"
                ? Math.min(...rangeCaptureMidisRef.current)
                : Math.max(...rangeCaptureMidisRef.current);
            setRangeCaptureState({
              status: "captured",
              target,
              latestMidi: capturedMidi,
              capturedMidi
            });
            void services.audioEngine.stop();
          }
        });
      } catch (error) {
        if (runId !== runIdRef.current) {
          return;
        }

        await services.audioEngine.stop();
        setRangeCaptureState({
          status: "error",
          target,
          errorMessage: createAudioErrorMessage(error)
        });
      }
    },
    [services, stopAttempt]
  );

  useEffect(() => {
    void stopAttempt();
    setLessonState(createLessonState(selectedExercise, settings.range));
    setAttemptScore(null);
    setPitchFrames([]);
  }, [selectedExercise, settings.range.lowestMidi, settings.range.highestMidi, stopAttempt]);

  const resetLesson = useCallback(async () => {
    await stopAttempt();
    setLessonState(createLessonState(selectedExercise, settings.range));
    setAttemptScore(null);
    setPitchFrames([]);
    framesRef.current = [];
    voiceStartMsRef.current = null;
    lastCompletionCheckMsRef.current = 0;
    finishStartedRef.current = false;
    pendingClipRef.current = null;
  }, [selectedExercise, settings.range, stopAttempt]);

  const deleteLocalClip = useCallback(async () => {
    revokeLocalClipUrl();
    setLocalClip(null);
    setClipErrorMessage(null);
    try {
      await deleteLatestAttemptClip();
    } catch {
      setClipErrorMessage("Could not delete the latest local clip.");
    }
  }, []);

  const clearLocalAttemptHistory = useCallback(async () => {
    setAttemptHistory([]);
    setPracticeSessions([]);
    activeSessionRef.current = null;
    await clearAttemptHistory();
  }, []);

  return {
    settings,
    setSettings,
    selectExercise,
    selectedExercise,
    exercises: EXERCISES,
    lessonState,
    pitchFrames,
    attemptScore,
    targetNotes,
    currentRootMidi,
    currentKeyLabel: `${midiToNoteName(currentRootMidi)} major`,
    exerciseLabel: formatExercisePattern(selectedExercise),
    noteOptions,
    listeningDurationMs: timelineDurationMs,
    errorMessage,
    exerciseProgress,
    practiceSummary,
    recommendedExercise,
    recentAttempts,
    recentSessions,
    attemptHistoryCount: attemptHistory.length,
    selectedExerciseHistory,
    localClip,
    clipErrorMessage,
    clearLocalAttemptHistory,
    deleteLocalClip,
    rangeCaptureState,
    saveRangeSetup,
    skipRangeSetup,
    startRangeCapture,
    stopRangeCapture,
    startPracticeSession,
    endPracticeSession,
    startAttempt,
    stopAttempt,
    resetLesson,
    isBusy:
      lessonState.status === "promptPlaying" ||
      lessonState.status === "awaitingVoice" ||
      lessonState.status === "listening" ||
      lessonState.status === "scoring"
  };

  async function persistPendingClip(score: AttemptScore) {
    const clip = pendingClipRef.current;
    pendingClipRef.current = null;
    if (!settings.saveLocalClips || !clip) {
      return;
    }

    try {
      await saveLatestAttemptClip({
        ...clip,
        score,
        pitchFrames: framesRef.current
      });
      setLocalClipFromBlob(clip);
      setClipErrorMessage(null);
    } catch {
      setClipErrorMessage("Could not save the latest local clip.");
    }
  }

  async function persistAttemptHistory(record: AttemptHistoryRecord) {
    setAttemptHistory((current) => mergeAttemptHistory([record], current));
    await saveAttemptHistoryRecord(record);
  }

  async function persistPracticeSession(record: PracticeSessionRecord) {
    activeSessionRef.current = record;
    setPracticeSessions((current) => mergePracticeSessions([record], current));
    await savePracticeSessionRecord(record);
  }

  function getOrCreateActivePracticeSession(exerciseId: ExerciseId) {
    if (activeSessionRef.current?.exerciseId === exerciseId) {
      return activeSessionRef.current;
    }

    const session = createPracticeSessionRecord({ exerciseId });
    activeSessionRef.current = session;
    return session;
  }

  function setLocalClipFromBlob(clip: CapturedAudioClip) {
    revokeLocalClipUrl();
    const url = URL.createObjectURL(clip.blob);
    localClipUrlRef.current = url;
    setLocalClip({
      url,
      createdAt: clip.createdAt,
      durationMs: clip.durationMs
    });
  }

  function revokeLocalClipUrl() {
    if (localClipUrlRef.current) {
      URL.revokeObjectURL(localClipUrlRef.current);
      localClipUrlRef.current = null;
    }
  }
}

function isVoiceStartFrame(frame: PitchFrame) {
  return frame.frequencyHz !== null && frame.rms >= VOICE_START_RMS;
}

function createAudioErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Microphone permission was denied. Allow mic access to practice with live pitch feedback.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Microphone setup failed. Check your browser permissions and audio input.";
}

function mergeAttemptHistory(
  primary: AttemptHistoryRecord[],
  secondary: AttemptHistoryRecord[]
) {
  const recordsById = new Map<string, AttemptHistoryRecord>();
  [...primary, ...secondary].forEach((record) => {
    recordsById.set(record.id, record);
  });
  return pruneAttemptHistory([...recordsById.values()]);
}

function mergePracticeSessions(
  primary: PracticeSessionRecord[],
  secondary: PracticeSessionRecord[]
) {
  const recordsById = new Map<string, PracticeSessionRecord>();
  [...primary, ...secondary].forEach((record) => {
    recordsById.set(record.id, record);
  });
  return [...recordsById.values()].sort(
    (a, b) => Date.parse(b.lastAttemptAt) - Date.parse(a.lastAttemptAt)
  );
}
