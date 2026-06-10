import { describe, expect, it } from "vitest";
import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  getThemeByName,
  PRESET_THEMES,
  resolveSystemDefaultTheme
} from ".";

describe("theme presets", () => {
  it("ships the warm default plus dark and light editor-style presets", () => {
    expect(PRESET_THEMES.map((theme) => theme.name)).toEqual([
      "Pitch Coach Warm",
      "One Dark",
      "Atom One Light"
    ]);
    expect(DEFAULT_DARK_THEME.type).toBe("dark");
    expect(DEFAULT_LIGHT_THEME.type).toBe("light");
    expect(DEFAULT_LIGHT_THEME.name).toBe("Pitch Coach Warm");
  });

  it("resolves themes by name and system color scheme", () => {
    expect(getThemeByName("One Dark")).toBe(DEFAULT_DARK_THEME);
    expect(getThemeByName("Pitch Coach Warm")).toBe(DEFAULT_LIGHT_THEME);
    expect(getThemeByName("Unknown")).toBeNull();
    expect(resolveSystemDefaultTheme("dark")).toBe(DEFAULT_DARK_THEME);
    expect(resolveSystemDefaultTheme("light")).toBe(DEFAULT_LIGHT_THEME);
  });
});
