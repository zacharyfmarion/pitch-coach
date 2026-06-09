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
