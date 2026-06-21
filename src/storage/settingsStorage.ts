import type { CoachSettings, ThemePreference, VocalRangeSetup } from "../domain/contracts";
import { DEFAULT_SETTINGS, isExerciseId, normalizeRange } from "../domain/exercise";
import { normalizeRandomRunConfig } from "../domain/randomRun";
import { normalizeGuideTempoBpm, normalizePreferredAudioInput } from "../domain/settings";
import { isDefaultRange } from "../domain/vocalRange";
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

    return normalizeSettings(JSON.parse(raw));
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
  const defaultTempoBpm = normalizeGuideTempoBpm(
    settings.defaultTempoBpm ?? settings.tempoBpm,
    DEFAULT_SETTINGS.defaultTempoBpm
  );
  const tempoBpm = normalizeGuideTempoBpm(settings.tempoBpm ?? defaultTempoBpm, defaultTempoBpm);

  return {
    exerciseId: isExerciseId(settings.exerciseId) ? settings.exerciseId : DEFAULT_SETTINGS.exerciseId,
    timingMode: "pitch-first",
    practiceMode: settings.practiceMode === "manual" ? "manual" : "auto",
    saveLocalClips: Boolean(settings.saveLocalClips),
    defaultTempoBpm,
    tempoBpm,
    toleranceCents: clampNumber(
      Math.round(settings.toleranceCents ?? DEFAULT_SETTINGS.toleranceCents),
      15,
      60,
      DEFAULT_SETTINGS.toleranceCents
    ),
    range: normalizeRange(settings.range ?? DEFAULT_SETTINGS.range),
    rangeSetup: normalizeRangeSetup(settings),
    themePreference: normalizeThemePreference(settings.themePreference),
    randomRun: normalizeRandomRunConfig(settings.randomRun),
    preferredAudioInput: normalizePreferredAudioInput(settings.preferredAudioInput)
  };
}

function normalizeRangeSetup(settings: Partial<CoachSettings>): VocalRangeSetup {
  const value = settings.rangeSetup;
  if (isRangeSetup(value)) {
    return {
      status: value.status,
      source: value.source,
      completedAt: typeof value.completedAt === "string" ? value.completedAt : undefined,
      skippedAt: typeof value.skippedAt === "string" ? value.skippedAt : undefined,
      lastPromptedAt: typeof value.lastPromptedAt === "string" ? value.lastPromptedAt : undefined
    };
  }

  const range = normalizeRange(settings.range ?? DEFAULT_SETTINGS.range);
  if (settings.range && !isDefaultRange(range, DEFAULT_SETTINGS.range)) {
    return {
      status: "completed",
      source: "manual"
    };
  }

  return DEFAULT_SETTINGS.rangeSetup;
}

function isRangeSetup(value: unknown): value is VocalRangeSetup {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const setup = value as Partial<VocalRangeSetup>;
  return (
    (setup.status === "unseen" || setup.status === "skipped" || setup.status === "completed") &&
    (setup.source === "default" || setup.source === "manual" || setup.source === "sing")
  );
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
