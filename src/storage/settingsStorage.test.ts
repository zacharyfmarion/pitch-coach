import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../domain/exercise";
import { loadSettings, normalizeSettings, saveSettings } from "./settingsStorage";

describe("settingsStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults theme preference to the system preference", () => {
    expect(loadSettings().themePreference).toBe("system");
    expect(normalizeSettings({}).themePreference).toBe("system");
  });

  it("normalizes invalid theme preferences to system", () => {
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      themePreference: "midnight" as typeof DEFAULT_SETTINGS.themePreference
    });

    expect(settings.themePreference).toBe("system");
  });

  it.each(["system", "light", "dark"] as const)("persists %s theme preference", (themePreference) => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      themePreference
    });

    expect(loadSettings().themePreference).toBe(themePreference);
  });
});
