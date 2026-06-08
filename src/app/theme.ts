import { useEffect, useState } from "react";
import type { ThemePreference } from "../domain/contracts";
import {
  applyTheme,
  getThemeByName,
  resolveSystemDefaultTheme,
  type PitchCoachTheme
} from "../themes";

type SystemTheme = "light" | "dark";

export function usePitchCoachTheme(themePreference: ThemePreference): PitchCoachTheme {
  const [systemTheme, setSystemTheme] = useState<SystemTheme>(() => getSystemTheme());
  const resolvedTheme = resolveThemePreference(themePreference, systemTheme);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => setSystemTheme(mediaQuery.matches ? "dark" : "light");
    updateSystemTheme();

    mediaQuery.addEventListener("change", updateSystemTheme);
    return () => mediaQuery.removeEventListener("change", updateSystemTheme);
  }, []);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  return resolvedTheme;
}

function resolveThemePreference(themePreference: ThemePreference, systemTheme: SystemTheme) {
  if (themePreference.mode === "system") {
    return resolveSystemDefaultTheme(systemTheme);
  }

  return getThemeByName(themePreference.themeName) ?? resolveSystemDefaultTheme(systemTheme);
}

function getSystemTheme(): SystemTheme {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
}
