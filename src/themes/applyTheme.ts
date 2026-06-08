import type { PitchCoachTheme, ThemeTokens } from "./types";
import { tokenToCssVar } from "./types";

const TOKEN_VARIABLE_MAP: Array<[keyof ThemeTokens, string]> = [
  ["bg.primary", "--bg-primary"],
  ["bg.secondary", "--bg-secondary"],
  ["bg.tertiary", "--bg-tertiary"],
  ["bg.tertiary", "--bg-elevated"],
  ["bg.surface", "--bg-surface"],
  ["bg.canvas", "--bg-canvas"],
  ["bg.canvasGrid", "--bg-canvas-grid"],
  ["text.primary", "--text-primary"],
  ["text.secondary", "--text-secondary"],
  ["text.muted", "--text-tertiary"],
  ["text.muted", "--text-muted"],
  ["text.inverse", "--text-inverse"],
  ["accent.primary", "--accent-primary"],
  ["accent.hover", "--accent-hover"],
  ["border.default", "--border-default"],
  ["border.active", "--border-strong"],
  ["status.success", "--status-success"],
  ["status.danger", "--status-danger"],
  ["port.color", "--accent-secondary"],
  ["port.color", "--status-warning"],
  ["port.image", "--accent-tertiary"],
  ["port.image", "--status-info"],
  ["shadow.overlay", "--shadow-overlay"],
  ["shadow.contextMenu", "--shadow-context-menu"]
];

function colorMix(color: string, amount: number): string {
  return `color-mix(in srgb, ${color} ${amount}%, transparent)`;
}

function hexToRgba(color: string, alpha: number): string {
  const match = color.trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) {
    return color;
  }

  const value = match[1];
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function setDerivedPitchCoachTokens(theme: PitchCoachTheme, setVar: (name: string, value: string) => void) {
  const { colors } = theme;
  const isLight = theme.type === "light";

  setVar("--border-subtle", colorMix(colors["border.default"], isLight ? 72 : 48));
  setVar("--overlay-dim", colors["shadow.overlay"]);
  setVar("--focus-ring", colorMix(colors["accent.primary"], 42));
  setVar("--surface-subtle", colorMix(colors["bg.surface"], isLight ? 76 : 62));
  setVar("--surface-selected", colorMix(colors["accent.primary"], isLight ? 12 : 17));
  setVar("--surface-warning", colorMix(colors["port.color"], isLight ? 10 : 14));
  setVar("--surface-danger", colorMix(colors["status.danger"], isLight ? 10 : 15));
  setVar("--surface-success", colorMix(colors["status.success"], isLight ? 12 : 16));
  setVar("--status-warning-text", colors["port.color"]);
  setVar("--status-danger-text", colors["status.danger"]);
  setVar("--status-success-text", colors["status.success"]);
  setVar("--range-accent", colors["port.bool"]);
  setVar("--score-neutral-bg", colorMix(colors["text.primary"], isLight ? 8 : 10));

  setVar("--timeline-surface", colors["bg.canvas"]);
  setVar("--timeline-target-band", hexToRgba(colors["accent.primary"], isLight ? 0.13 : 0.18));
  setVar("--timeline-target-line", hexToRgba(colors["accent.primary"], isLight ? 0.72 : 0.78));
  setVar("--timeline-target-text", colors["text.primary"]);
  setVar("--timeline-status-text", colors["text.secondary"]);
  setVar("--timeline-grid-border", colors["border.default"]);
  setVar("--timeline-grid-line", hexToRgba(colors["text.primary"], isLight ? 0.1 : 0.08));
  setVar("--timeline-grid-strong-line", hexToRgba(colors["text.primary"], isLight ? 0.18 : 0.16));
  setVar("--timeline-grid-label", colors["text.secondary"]);
  setVar("--timeline-time-marker", hexToRgba(colors["border.default"], isLight ? 0.78 : 0.88));
  setVar("--timeline-ignored-event", hexToRgba(colors["text.secondary"], 0.28));
  setVar("--timeline-pitch-line", hexToRgba(colors["port.bool"], isLight ? 0.7 : 0.78));
  setVar("--timeline-noisy-frame", hexToRgba(colors["status.danger"], 0.28));
  setVar("--timeline-pass-line", colors["status.success"]);
  setVar("--timeline-error-line", colors["status.danger"]);

  setVar("--song-timeline-missed-region", hexToRgba(colors["status.danger"], isLight ? 0.14 : 0.2));
  setVar("--song-timeline-off-pitch-region", hexToRgba(colors["port.bool"], isLight ? 0.13 : 0.18));
  setVar("--song-timeline-reference-band", hexToRgba(colors["port.image"], isLight ? 0.16 : 0.18));
  setVar("--song-timeline-reference-border", hexToRgba(colors["port.image"], isLight ? 0.58 : 0.62));
  setVar("--song-timeline-reference-line", hexToRgba(colors["port.image"], isLight ? 0.88 : 0.92));
  setVar("--song-timeline-live-line", hexToRgba(colors["port.bool"], isLight ? 0.62 : 0.78));
  setVar("--song-timeline-playhead", colors["accent.primary"]);
  setVar("--song-timeline-debug-surface", colors["bg.secondary"]);
  setVar("--song-timeline-debug-border", colors["border.default"]);
  setVar("--song-timeline-debug-bar", hexToRgba(colors["accent.primary"], isLight ? 0.46 : 0.54));
}

export function applyTheme(theme: PitchCoachTheme): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  for (const [token, value] of Object.entries(theme.colors)) {
    root.style.setProperty(tokenToCssVar(token), value);
  }
  for (const [token, variable] of TOKEN_VARIABLE_MAP) {
    root.style.setProperty(variable, theme.colors[token]);
  }

  setDerivedPitchCoachTokens(theme, (name, value) => root.style.setProperty(name, value));
  root.dataset.theme = theme.type;
  root.dataset.themeType = theme.type;
  root.dataset.themeName = theme.name;
  root.style.colorScheme = theme.type;
}
