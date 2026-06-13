import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../domain/exercise";
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from "../themes";
import { loadSettings, normalizeSettings, saveSettings } from "./settingsStorage";

describe("settingsStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults theme preference to the system preference", () => {
    expect(loadSettings().themePreference).toEqual({ mode: "system" });
    expect(normalizeSettings({}).themePreference).toEqual({ mode: "system" });
  });

  it("defaults vocal range setup to unseen", () => {
    expect(loadSettings().rangeSetup).toEqual({ status: "unseen", source: "default" });
    expect(normalizeSettings({}).rangeSetup).toEqual({ status: "unseen", source: "default" });
  });

  it("defaults guide tempo settings to the medium practice tempo", () => {
    expect(loadSettings().defaultTempoBpm).toBe(90);
    expect(loadSettings().tempoBpm).toBe(90);
    expect(normalizeSettings({}).defaultTempoBpm).toBe(90);
    expect(normalizeSettings({}).tempoBpm).toBe(90);
  });

  it("migrates legacy tempo into the default guide tempo", () => {
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      defaultTempoBpm: undefined,
      tempoBpm: 76
    });

    expect(settings.defaultTempoBpm).toBe(76);
    expect(settings.tempoBpm).toBe(76);
  });

  it("persists preferred audio input metadata", () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      preferredAudioInput: {
        deviceId: "mic-1",
        label: "Studio Condenser",
        selectedAt: "2026-06-12T12:00:00.000Z"
      }
    });

    expect(loadSettings().preferredAudioInput).toEqual({
      deviceId: "mic-1",
      label: "Studio Condenser",
      selectedAt: "2026-06-12T12:00:00.000Z"
    });
  });

  it("normalizes invalid preferred audio input metadata to default input", () => {
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      preferredAudioInput: {
        deviceId: "",
        label: ""
      }
    });

    expect(settings.preferredAudioInput).toBeUndefined();
  });

  it("persists vocal range setup metadata", () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      rangeSetup: {
        status: "completed",
        source: "manual",
        completedAt: "2026-06-11T20:00:00.000Z"
      }
    });

    expect(loadSettings().rangeSetup).toEqual({
      status: "completed",
      source: "manual",
      completedAt: "2026-06-11T20:00:00.000Z",
      skippedAt: undefined,
      lastPromptedAt: undefined
    });
  });

  it("marks legacy custom ranges as already completed", () => {
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      rangeSetup: undefined,
      range: {
        lowestMidi: 41,
        highestMidi: 65
      }
    });

    expect(settings.rangeSetup).toEqual({
      status: "completed",
      source: "manual"
    });
  });

  it("normalizes invalid theme preferences to system", () => {
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      themePreference: {
        mode: "theme",
        themeName: "Midnight"
      }
    });

    expect(settings.themePreference).toEqual({ mode: "system" });
  });

  it("persists named theme preferences", () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      themePreference: {
        mode: "theme",
        themeName: DEFAULT_DARK_THEME.name
      }
    });

    expect(loadSettings().themePreference).toEqual({
      mode: "theme",
      themeName: DEFAULT_DARK_THEME.name
    });
  });

  it.each([
    ["system", { mode: "system" }],
    ["light", { mode: "theme", themeName: DEFAULT_LIGHT_THEME.name }],
    ["dark", { mode: "theme", themeName: DEFAULT_DARK_THEME.name }]
  ] as const)("migrates legacy %s theme preference", (themePreference, expected) => {
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      themePreference: themePreference as unknown as typeof DEFAULT_SETTINGS.themePreference
    });

    expect(settings.themePreference).toEqual(expected);
  });
});
