import { useEffect } from "react";
import type { ThemePreference } from "../domain/contracts";
import {
  applyTheme,
  DEFAULT_THEME,
  type PitchCoachTheme
} from "../themes";

export function usePitchCoachTheme(_themePreference: ThemePreference): PitchCoachTheme {
  const resolvedTheme = DEFAULT_THEME;

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  return resolvedTheme;
}
