import type { CoachSettings, ThemePreference } from "../domain/contracts";
import { DEFAULT_SETTINGS, isExerciseId, normalizeRange } from "../domain/exercise";
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, getThemeByName } from "../themes";

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

export function normalizeSettings(settings: Partial<CoachSettings>): CoachSettings {
  return {
    exerciseId: isExerciseId(settings.exerciseId) ? settings.exerciseId : DEFAULT_SETTINGS.exerciseId,
    timingMode: "pitch-first",
    saveLocalClips: Boolean(settings.saveLocalClips),
    tempoBpm: clampNumber(
      Math.round(settings.tempoBpm ?? DEFAULT_SETTINGS.tempoBpm),
      50,
      140,
      DEFAULT_SETTINGS.tempoBpm
    ),
    toleranceCents: clampNumber(
      Math.round(settings.toleranceCents ?? DEFAULT_SETTINGS.toleranceCents),
      15,
      60,
      DEFAULT_SETTINGS.toleranceCents
    ),
    range: normalizeRange(settings.range ?? DEFAULT_SETTINGS.range),
    themePreference: normalizeThemePreference(settings.themePreference)
  };
}

function normalizeThemePreference(value: unknown): ThemePreference {
  if (value === "system") {
    return {
      mode: "system"
    };
  }

  if (value === "dark") {
    return {
      mode: "theme",
      themeName: DEFAULT_DARK_THEME.name
    };
  }

  if (value === "light") {
    return {
      mode: "theme",
      themeName: DEFAULT_LIGHT_THEME.name
    };
  }

  if (isThemePreference(value)) {
    if (value.mode === "system") {
      return {
        mode: "system"
      };
    }

    const theme = getThemeByName(value.themeName);
    if (theme) {
      return {
        mode: "theme",
        themeName: theme.name
      };
    }
  }

  return DEFAULT_SETTINGS.themePreference;
}

function isThemePreference(value: unknown): value is ThemePreference {
  if (typeof value !== "object" || value === null || !("mode" in value)) {
    return false;
  }

  const mode = (value as { mode?: unknown }).mode;
  if (mode === "system") {
    return true;
  }

  return mode === "theme" && typeof (value as { themeName?: unknown }).themeName === "string";
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}
