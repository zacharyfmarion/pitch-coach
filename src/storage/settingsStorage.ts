import type { CoachSettings } from "../domain/contracts";
import { DEFAULT_SETTINGS, isExerciseId, normalizeRange } from "../domain/exercise";

const STORAGE_KEY = "pitch-coach-settings-v1";

export function loadSettings(): CoachSettings {
  if (typeof localStorage === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    return normalizeSettings({
      ...DEFAULT_SETTINGS,
      ...JSON.parse(raw)
    });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: CoachSettings) {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
}

export function normalizeSettings(settings: CoachSettings): CoachSettings {
  return {
    exerciseId: isExerciseId(settings.exerciseId) ? settings.exerciseId : DEFAULT_SETTINGS.exerciseId,
    timingMode: "pitch-first",
    saveLocalClips: Boolean(settings.saveLocalClips),
    tempoBpm: clampNumber(Math.round(settings.tempoBpm), 50, 140, DEFAULT_SETTINGS.tempoBpm),
    toleranceCents: clampNumber(
      Math.round(settings.toleranceCents),
      15,
      60,
      DEFAULT_SETTINGS.toleranceCents
    ),
    range: normalizeRange(settings.range)
  };
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}
