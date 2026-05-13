import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AttemptScore, CoachSettings, PitchFrame } from "../domain/contracts";
import {
  buildTargetNotes,
  createNoteOptions,
  createScoringPolicy,
  formatExercisePattern,
  MAJOR_TRIAD_EXERCISE
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
import { midiToFrequency, midiToNoteName } from "../domain/music";
import { isPitchFirstAttemptComplete, scoreAttempt } from "../domain/scoring";
import type { CapturedAudioClip } from "../audio/types";
import { createPitchCoachServices, type PitchCoachServices } from "../audio/services";
import {
  deleteLatestAttemptClip,
  loadLatestAttemptClip,
  saveLatestAttemptClip
} from "../storage/clipStorage";
import { loadSettings, normalizeSettings, saveSettings } from "../storage/settingsStorage";

const PASS_ADVANCE_DELAY_MS = 900;
const VOICE_START_RMS = 0.006;
const MAX_RENDERED_FRAMES = 1000;

export type PitchCoachControllerOptions = {
  services?: PitchCoachServices;
  initialSettings?: CoachSettings;
};

export type LocalClipView = {
  url: string;
  createdAt: string;
  durationMs: number;
};

export function usePitchCoachController(options: PitchCoachControllerOptions = {}) {
  const services = useMemo(() => options.services ?? createPitchCoachServices(), [options.services]);
  const [settings, setSettingsState] = useState<CoachSettings>(() =>
    normalizeSettings(options.initialSettings ?? loadSettings())
  );
  const [lessonState, setLessonState] = useState(() =>
    createLessonState(MAJOR_TRIAD_EXERCISE, settings.range)
  );
  const [pitchFrames, setPitchFrames] = useState<PitchFrame[]>([]);
  const [attemptScore, setAttemptScore] = useState<AttemptScore | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [queuedAutoStart, setQueuedAutoStart] = useState(false);
  const [localClip, setLocalClip] = useState<LocalClipView | null>(null);
  const [clipErrorMessage, setClipErrorMessage] = useState<string | null>(null);

  const runIdRef = useRef(0);
  const framesRef = useRef<PitchFrame[]>([]);
  const voiceStartMsRef = useRef<number | null>(null);
  const lastCompletionCheckMsRef = useRef(0);
  const finishStartedRef = useRef(false);
  const pendingClipRef = useRef<CapturedAudioClip | null>(null);
  const localClipUrlRef = useRef<string | null>(null);
  const lessonStateRef = useRef(lessonState);
  const listeningTimerRef = useRef<number | null>(null);
  const passTimerRef = useRef<number | null>(null);

  const currentRootMidi = getCurrentRootMidi(lessonState) ?? MAJOR_TRIAD_EXERCISE.startRootMidi;
  const targetNotes = useMemo(
    () => buildTargetNotes(currentRootMidi, MAJOR_TRIAD_EXERCISE, settings.tempoBpm),
    [currentRootMidi, settings.tempoBpm]
  );
  const noteOptions = useMemo(() => createNoteOptions(), []);
  const scoringPolicy = useMemo(() => createScoringPolicy(settings), [settings]);
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

  const finishAttempt = useCallback(
    async (runId: number, attemptTargets = targetNotes) => {
      if (runId !== runIdRef.current || finishStartedRef.current) {
        return;
      }

      finishStartedRef.current = true;
      clearListeningTimer();
      setLessonState((current) => beginScoring(current));
      await services.audioEngine.stop();

      const score = scoreAttempt(framesRef.current, attemptTargets, scoringPolicy, settings.range);
      setAttemptScore(score);
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
      scoringPolicy,
      services.audioEngine,
      settings.range,
      settings.saveLocalClips,
      targetNotes
    ]
  );

  const startAttempt = useCallback(async () => {
    const rootMidi = getCurrentRootMidi(lessonStateRef.current);
    if (rootMidi === null) {
      setErrorMessage("Your range is too narrow for a full 1-3-5 triad.");
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

    const attemptTargets = buildTargetNotes(rootMidi, MAJOR_TRIAD_EXERCISE, settings.tempoBpm);
    const bounds = {
      minFrequencyHz: midiToFrequency(settings.range.lowestMidi),
      maxFrequencyHz: midiToFrequency(settings.range.highestMidi)
    };

    try {
      setLessonState((current) => startPrompt(current));
      await services.promptPlayer.playPrompt(attemptTargets, settings.tempoBpm);
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
              () => void finishAttempt(runId, attemptTargets),
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
              void finishAttempt(runId, attemptTargets);
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
  }, [clearTimers, services]);

  useEffect(() => {
    void stopAttempt();
    setLessonState(createLessonState(MAJOR_TRIAD_EXERCISE, settings.range));
    setAttemptScore(null);
    setPitchFrames([]);
  }, [settings.range.lowestMidi, settings.range.highestMidi, stopAttempt]);

  const resetLesson = useCallback(async () => {
    await stopAttempt();
    setLessonState(createLessonState(MAJOR_TRIAD_EXERCISE, settings.range));
    setAttemptScore(null);
    setPitchFrames([]);
    framesRef.current = [];
    voiceStartMsRef.current = null;
    lastCompletionCheckMsRef.current = 0;
    finishStartedRef.current = false;
    pendingClipRef.current = null;
  }, [settings.range, stopAttempt]);

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

  return {
    settings,
    setSettings,
    lessonState,
    pitchFrames,
    attemptScore,
    targetNotes,
    currentRootMidi,
    currentKeyLabel: `${midiToNoteName(currentRootMidi)} major`,
    exerciseLabel: formatExercisePattern(MAJOR_TRIAD_EXERCISE),
    noteOptions,
    listeningDurationMs: timelineDurationMs,
    errorMessage,
    localClip,
    clipErrorMessage,
    deleteLocalClip,
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
