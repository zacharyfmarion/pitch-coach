import atomOneLight from "./presets/atom-one-light.json";
import oneDark from "./presets/one-dark.json";
import pitchCoachWarm from "./presets/pitch-coach-warm.json";
import { applyTheme } from "./applyTheme";
import type { PitchCoachTheme } from "./types";

const oneDarkTheme = oneDark as PitchCoachTheme;
const atomOneLightTheme = atomOneLight as PitchCoachTheme;
const pitchCoachWarmTheme = pitchCoachWarm as PitchCoachTheme;

export const PRESET_THEMES = [
  pitchCoachWarmTheme,
  oneDarkTheme,
  atomOneLightTheme
] satisfies PitchCoachTheme[];
export const DEFAULT_DARK_THEME = oneDarkTheme;
export const DEFAULT_LIGHT_THEME = pitchCoachWarmTheme;
export const DEFAULT_THEME = DEFAULT_LIGHT_THEME;

export function getThemeByName(themeName: string): PitchCoachTheme | null {
  return PRESET_THEMES.find((theme) => theme.name === themeName) ?? null;
}

export function resolveSystemDefaultTheme(systemTheme: "dark" | "light"): PitchCoachTheme {
  return systemTheme === "light" ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME;
}

export { applyTheme };
export type { PitchCoachTheme, SyntaxColors, ThemeTokens } from "./types";
