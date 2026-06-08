import { describe, expect, it } from "vitest";
import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  getThemeByName,
  PRESET_THEMES,
  resolveSystemDefaultTheme
} from ".";

describe("theme presets", () => {
  it("ships the initial dark and light presets", () => {
    expect(PRESET_THEMES.map((theme) => theme.name)).toEqual(["One Dark", "Atom One Light"]);
    expect(DEFAULT_DARK_THEME.type).toBe("dark");
    expect(DEFAULT_LIGHT_THEME.type).toBe("light");
  });

  it("resolves themes by name and system color scheme", () => {
    expect(getThemeByName("One Dark")).toBe(DEFAULT_DARK_THEME);
    expect(getThemeByName("Unknown")).toBeNull();
    expect(resolveSystemDefaultTheme("dark")).toBe(DEFAULT_DARK_THEME);
    expect(resolveSystemDefaultTheme("light")).toBe(DEFAULT_LIGHT_THEME);
  });
});
