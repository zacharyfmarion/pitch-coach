import type { PreferredAudioInput } from "./contracts";

export type SettingsSectionId = "voice" | "practice" | "audio";

export type StrictnessPresetId = "gentle" | "standard" | "strict";

export type StrictnessPreset = {
  id: StrictnessPresetId;
  label: string;
  toleranceCents: number;
};

export const SCORING_STRICTNESS_PRESETS: readonly StrictnessPreset[] = [
  { id: "gentle", label: "Gentle", toleranceCents: 50 },
  { id: "standard", label: "Standard", toleranceCents: 35 },
  { id: "strict", label: "Strict", toleranceCents: 22 }
];

export type TempoOption = {
  label: string;
  bpm: number;
};

export const DEFAULT_GUIDE_TEMPO_BPM = 90;
export const MIN_GUIDE_TEMPO_BPM = 50;
export const MAX_GUIDE_TEMPO_BPM = 140;

export const DEFAULT_TEMPO_OPTIONS: readonly TempoOption[] = [
  { label: "Slow", bpm: 70 },
  { label: "Medium", bpm: 90 },
  { label: "Brisk", bpm: 110 }
];

export function getStrictnessPreset(toleranceCents: number): StrictnessPreset {
  return SCORING_STRICTNESS_PRESETS.reduce((closest, preset) =>
    Math.abs(preset.toleranceCents - toleranceCents) <
    Math.abs(closest.toleranceCents - toleranceCents)
      ? preset
      : closest
  );
}

export function getStrictnessPresetId(toleranceCents: number): StrictnessPresetId {
  return getStrictnessPreset(toleranceCents).id;
}

export function getStrictnessToleranceCents(presetId: StrictnessPresetId): number {
  return (
    SCORING_STRICTNESS_PRESETS.find((preset) => preset.id === presetId) ??
    SCORING_STRICTNESS_PRESETS[1]
  ).toleranceCents;
}

export function normalizeGuideTempoBpm(value: unknown, fallback = DEFAULT_GUIDE_TEMPO_BPM) {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(
    Math.max(Math.round(numericValue), MIN_GUIDE_TEMPO_BPM),
    MAX_GUIDE_TEMPO_BPM
  );
}

export function normalizePreferredAudioInput(value: unknown): PreferredAudioInput | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const input = value as Partial<PreferredAudioInput>;
  const deviceId = normalizeOptionalText(input.deviceId);
  const label = normalizeOptionalText(input.label);
  const selectedAt = normalizeOptionalText(input.selectedAt);

  if (!deviceId && !label) {
    return undefined;
  }

  return {
    ...(deviceId ? { deviceId } : {}),
    ...(label ? { label } : {}),
    ...(selectedAt ? { selectedAt } : {})
  };
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
