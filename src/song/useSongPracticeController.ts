import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PitchFrame } from "../domain/contracts";
import { loadSettings, normalizeSettings, saveSettings } from "../storage/settingsStorage";
import { sliceStereoBuffer } from "./audioData";
import { createSongPracticePitchBounds, createSongReferenceRange } from "./referenceRange";
import { isCurrentSongReference } from "./referenceVersion";
import { createSongModeServices } from "./services";
import { scoreSongAttempt } from "./songScoring";
import { pendingSongRuntimeSupport } from "./support";
import { DEFAULT_REFERENCE_DETAIL, REFERENCE_DETAIL_OPTIONS } from "./transcriptionConfig";
import type {
  SongModeServices,
  SongReference,
  SongReferenceDetail,
  SongRuntimeSupport,
  SongScore,
  SongSeparationResult,
  SongStereoBuffer
} from "./types";

const DEFAULT_SECTION_MS = 60000;
const MAX_SECTION_MS = 90000;
const MIN_SECTION_MS = 30000;
const MAX_RENDERED_FRAMES = 1800;

export type SongPracticeStage =
  | "checking"
  | "unsupported"
  | "empty"
  | "decoding"
  | "decoded"
  | "analyzing"
  | "ready"
  | "practicing"
  | "complete"
  | "error";

export type SongAnalysisProgress = {
  modelProgress: number;
  separationProgress: number;
  transcriptionProgress: number;
  status: string;
};

export type SongPracticeControllerOptions = {
  services?: SongModeServices;
};

export function useSongPracticeController(options: SongPracticeControllerOptions = {}) {
  const services = useMemo(() => options.services ?? createSongModeServices(), [options.services]);
  const [support, setSupport] = useState<SongRuntimeSupport>(() => pendingSongRuntimeSupport());
  const [settings, setSettingsState] = useState(() => normalizeSettings(loadSettings()));
  const [stage, setStage] = useState<SongPracticeStage>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [decodedAudio, setDecodedAudio] = useState<SongStereoBuffer | null>(null);
  const [trimStartMs, setTrimStartMsState] = useState(0);
  const [trimEndMs, setTrimEndMsState] = useState(DEFAULT_SECTION_MS);
  const [analysisProgress, setAnalysisProgress] = useState<SongAnalysisProgress>({
    modelProgress: 0,
    separationProgress: 0,
    transcriptionProgress: 0,
    status: "Idle"
  });
  const [separation, setSeparation] = useState<SongSeparationResult | null>(null);
  const [reference, setReference] = useState<SongReference | null>(null);
  const [liveFrames, setLiveFrames] = useState<PitchFrame[]>([]);
  const [score, setScore] = useState<SongScore | null>(null);
  const [vocalGuideGain, setVocalGuideGainState] = useState(0);
  const [currentPlaybackTimeMs, setCurrentPlaybackTimeMs] = useState(0);
  const [referenceDetail, setReferenceDetailState] =
    useState<SongReferenceDetail>(DEFAULT_REFERENCE_DETAIL);

  const liveFramesRef = useRef<PitchFrame[]>([]);
  const referenceRef = useRef<SongReference | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void services.detectSupport().then((nextSupport) => {
      if (cancelled) {
        return;
      }

      setSupport(nextSupport);
      setStage(nextSupport.supported ? "empty" : "unsupported");
    });

    return () => {
      cancelled = true;
    };
  }, [services]);

  useEffect(() => {
    referenceRef.current = reference;
  }, [reference]);

  useEffect(
    () => () => {
      runIdRef.current += 1;
      void services.practiceEngine.stop();
    },
    [services.practiceEngine]
  );

  const selectedDurationMs = Math.max(0, trimEndMs - trimStartMs);
  const selectedDurationFits =
    selectedDurationMs <= MAX_SECTION_MS &&
    (!decodedAudio || decodedAudio.durationMs < MIN_SECTION_MS || selectedDurationMs >= MIN_SECTION_MS);
  const canAnalyze =
    support.supported &&
    decodedAudio !== null &&
    selectedDurationFits &&
    stage !== "analyzing" &&
    stage !== "practicing";
  const canPractice = Boolean(reference && separation && (stage === "ready" || stage === "complete"));

  const clearAttemptState = useCallback((options: { clearSeparation: boolean }) => {
    if (options.clearSeparation) {
      setSeparation(null);
    }
    setReference(null);
    setLiveFrames([]);
    setScore(null);
    setCurrentPlaybackTimeMs(0);
    liveFramesRef.current = [];
  }, []);

  const chooseFile = useCallback(
    async (file: File) => {
      runIdRef.current += 1;
      await services.practiceEngine.stop();
      setStage("decoding");
      setErrorMessage(null);
      setFileName(file.name);
      setDecodedAudio(null);
      clearAttemptState({ clearSeparation: true });

      try {
        const audio = await services.decodeFile(file);
        setDecodedAudio(audio);
        const defaultEndMs = Math.min(audio.durationMs, DEFAULT_SECTION_MS);
        setTrimStartMsState(0);
        setTrimEndMsState(Math.max(defaultEndMs, Math.min(audio.durationMs, MIN_SECTION_MS)));
        setStage("decoded");
      } catch (error) {
        setStage("error");
        setErrorMessage(createSongErrorMessage(error));
      }
    },
    [clearAttemptState, services]
  );

  const setTrimStartMs = useCallback(
    (nextStartMs: number) => {
      if (!decodedAudio) {
        return;
      }

      const maxStart = Math.max(0, decodedAudio.durationMs - 1000);
      const startMs = clamp(nextStartMs, 0, maxStart);
      const maxEndMs = Math.min(decodedAudio.durationMs, startMs + MAX_SECTION_MS);
      setTrimStartMsState(startMs);
      setTrimEndMsState((currentEndMs) =>
        clamp(Math.max(currentEndMs, startMs + 1000), startMs + 1000, maxEndMs)
      );
      clearAttemptState({ clearSeparation: true });
      setStage("decoded");
    },
    [clearAttemptState, decodedAudio]
  );

  const setTrimEndMs = useCallback(
    (nextEndMs: number) => {
      if (!decodedAudio) {
        return;
      }

      setTrimEndMsState(
        clamp(nextEndMs, trimStartMs + 1000, Math.min(decodedAudio.durationMs, trimStartMs + MAX_SECTION_MS))
      );
      clearAttemptState({ clearSeparation: true });
      setStage("decoded");
    },
    [clearAttemptState, decodedAudio, trimStartMs]
  );

  const analyzeSong = useCallback(async () => {
    if (!decodedAudio || !support.supported) {
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    await services.practiceEngine.stop();
    setStage("analyzing");
    setErrorMessage(null);
    clearAttemptState({ clearSeparation: false });
    setAnalysisProgress({
      modelProgress: 0,
      separationProgress: 0,
      transcriptionProgress: 0,
      status: "Preparing selected section"
    });

    try {
      let separated = separation;
      if (!separated) {
        const selectedAudio = sliceStereoBuffer(decodedAudio, trimStartMs, trimEndMs);
        separated = await services.separator.separate(selectedAudio, {
          onModelDownloadProgress: (progress) =>
            setAnalysisProgress((current) => ({
              ...current,
              modelProgress: Math.max(current.modelProgress, progress.progress),
              status: "Loading vocal isolation model"
            })),
          onSeparationProgress: (progress) =>
            setAnalysisProgress((current) => ({
              ...current,
              separationProgress: progress.progress,
              status: "Separating vocals"
            })),
          onStatus: (status) => setAnalysisProgress((current) => ({ ...current, status }))
        });
      } else {
        setAnalysisProgress((current) => ({
          ...current,
          modelProgress: 1,
          separationProgress: 1,
          status: "Using separated vocals"
        }));
      }

      if (runId !== runIdRef.current) {
        return;
      }

      const songReferenceRange = createSongReferenceRange(settings.range);
      const nextReference = await services.transcriber.transcribe(separated.vocals, {
        range: songReferenceRange,
        detail: referenceDetail,
        onProgress: (progress) =>
          setAnalysisProgress((current) => ({
            ...current,
            transcriptionProgress: progress.progress,
            status: "Transcribing vocal notes"
          })),
        onStatus: (status) => setAnalysisProgress((current) => ({ ...current, status }))
      });
      if (nextReference.notes.length === 0) {
        throw new Error("No vocal notes were found. Try Sensitive reference detail or choose a clearer section.");
      }

      setSeparation(separated);
      setReference(nextReference);
      setAnalysisProgress({
        modelProgress: 1,
        separationProgress: 1,
        transcriptionProgress: 1,
        status: "Ready to practice"
      });
      setStage("ready");
    } catch (error) {
      if (runId !== runIdRef.current) {
        return;
      }

      setStage("error");
      setErrorMessage(createSongErrorMessage(error));
    }
  }, [
    clearAttemptState,
    decodedAudio,
    services.practiceEngine,
    services.separator,
    services.transcriber,
    separation,
    referenceDetail,
    settings.range.highestMidi,
    settings.range.lowestMidi,
    support.supported,
    trimEndMs,
    trimStartMs
  ]);

  const startPractice = useCallback(async () => {
    if (!reference || !separation) {
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setStage("practicing");
    setErrorMessage(null);
    setLiveFrames([]);
    setScore(null);
    setCurrentPlaybackTimeMs(0);
    liveFramesRef.current = [];

    try {
      await services.practiceEngine.start({
        accompaniment: separation.accompaniment,
        vocals: separation.vocals,
        detector: services.detector,
        bounds: createSongPracticePitchBounds(
          reference,
          reference.analysisRange ?? createSongReferenceRange(settings.range)
        ),
        vocalGuideGain,
        onPitchFrame: (frame) => {
          if (runId !== runIdRef.current) {
            return;
          }

          liveFramesRef.current = [...liveFramesRef.current, frame].slice(-MAX_RENDERED_FRAMES);
          setLiveFrames(liveFramesRef.current);
          setScore(scoreSongAttempt(reference, liveFramesRef.current, settings.toleranceCents));
        },
        onPlaybackTime: (timeMs) => {
          if (runId !== runIdRef.current) {
            return;
          }

          setCurrentPlaybackTimeMs(timeMs);
        },
        onEnded: () => {
          if (runId !== runIdRef.current) {
            return;
          }

          setScore(scoreSongAttempt(reference, liveFramesRef.current, settings.toleranceCents));
          setStage("complete");
        }
      });
    } catch (error) {
      if (runId !== runIdRef.current) {
        return;
      }

      setStage("ready");
      setErrorMessage(createSongErrorMessage(error));
    }
  }, [
    reference,
    separation,
    services.detector,
    services.practiceEngine,
    settings.range.highestMidi,
    settings.range.lowestMidi,
    settings.toleranceCents,
    vocalGuideGain
  ]);

  const stopPractice = useCallback(async () => {
    runIdRef.current += 1;
    await services.practiceEngine.stop();
    if (referenceRef.current) {
      setScore(scoreSongAttempt(referenceRef.current, liveFramesRef.current, settings.toleranceCents));
      setStage("complete");
    } else {
      setStage("decoded");
    }
  }, [services.practiceEngine, settings.toleranceCents]);

  const resetSong = useCallback(async () => {
    runIdRef.current += 1;
    await services.practiceEngine.stop();
    setStage(support.supported ? "empty" : "unsupported");
    setErrorMessage(null);
    setFileName(null);
    setDecodedAudio(null);
    setSeparation(null);
    setReference(null);
    setScore(null);
    setLiveFrames([]);
    setCurrentPlaybackTimeMs(0);
    liveFramesRef.current = [];
    setTrimStartMsState(0);
    setTrimEndMsState(DEFAULT_SECTION_MS);
  }, [services.practiceEngine, support.supported]);

  const setReferenceDetail = useCallback(
    (detail: SongReferenceDetail) => {
      setReferenceDetailState(detail);
      if (reference && stage !== "practicing") {
        clearAttemptState({ clearSeparation: false });
        setStage("decoded");
        setAnalysisProgress((current) => ({
          ...current,
          transcriptionProgress: 0,
          status: "Reference detail changed. Analyze again."
        }));
      }
    },
    [clearAttemptState, reference, stage]
  );

  const setToleranceCents = useCallback(
    (toleranceCents: number) => {
      const nextSettings = normalizeSettings({
        ...settings,
        toleranceCents
      });
      setSettingsState(nextSettings);
      saveSettings(nextSettings);
      if (reference) {
        setScore(scoreSongAttempt(reference, liveFramesRef.current, nextSettings.toleranceCents));
      }
    },
    [reference, settings]
  );

  const setVocalGuideGain = useCallback(
    (gain: number) => {
      const clamped = clamp(gain, 0, 1);
      setVocalGuideGainState(clamped);
      services.practiceEngine.setVocalGuideGain(clamped);
    },
    [services.practiceEngine]
  );

  useEffect(() => {
    if (!reference || isCurrentSongReference(reference) || stage === "practicing") {
      return;
    }

    clearAttemptState({ clearSeparation: false });
    setStage("decoded");
    setAnalysisProgress((current) => ({
      ...current,
      transcriptionProgress: 0,
      status: "Transcription engine updated. Analyze song again."
    }));
  }, [clearAttemptState, reference, stage]);

  return {
    support,
    stage,
    errorMessage,
    fileName,
    decodedAudio,
    trimStartMs,
    trimEndMs,
    selectedDurationMs,
    analysisProgress,
    reference,
    separation,
    liveFrames,
    score,
    currentPlaybackTimeMs,
    referenceDetail,
    referenceDetailOptions: REFERENCE_DETAIL_OPTIONS,
    toleranceCents: settings.toleranceCents,
    vocalGuideGain,
    canAnalyze,
    canPractice,
    chooseFile,
    setTrimStartMs,
    setTrimEndMs,
    analyzeSong,
    startPractice,
    stopPractice,
    resetSong,
    setReferenceDetail,
    setToleranceCents,
    setVocalGuideGain,
    isBusy: stage === "decoding" || stage === "analyzing" || stage === "practicing"
  };
}

function createSongErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Microphone permission was denied. Allow mic access to practice with song feedback.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Song mode failed. Try a shorter audio section or a different file.";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export const SONG_SECTION_LIMITS = {
  minMs: MIN_SECTION_MS,
  maxMs: MAX_SECTION_MS,
  defaultMs: DEFAULT_SECTION_MS
};
