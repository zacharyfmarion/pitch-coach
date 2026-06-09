import { Monitor, Moon, Sun } from "lucide-react";
import type { ThemePreference } from "../domain/contracts";
import { PRESET_THEMES, type PitchCoachTheme } from "../themes";

type ThemePickerOption = {
  key: string;
  label: string;
  preference: ThemePreference;
  icon: typeof Monitor;
  theme?: PitchCoachTheme;
};

const themeOptions: ThemePickerOption[] = [
  {
    key: "system",
    label: "System",
    preference: {
      mode: "system"
    },
    icon: Monitor
  },
  ...PRESET_THEMES.map(
    (theme): ThemePickerOption => ({
      key: `theme:${theme.name}`,
      label: theme.name,
      preference: {
        mode: "theme",
        themeName: theme.name
      },
      icon: theme.type === "light" ? Sun : Moon,
      theme
    })
  )
];

export function ThemePicker({
  value,
  onValueChange
}: {
  value: ThemePreference;
  onValueChange: (themePreference: ThemePreference) => void;
}) {
  const selectedKey = themePreferenceKey(value);

  return (
    <div className="theme-picker" role="radiogroup" aria-label="Theme">
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const isSelected = selectedKey === option.key;
        return (
          <button
            key={option.key}
            className={`theme-option${isSelected ? " theme-option-active" : ""}`}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${option.label} theme`}
            title={`${option.label} theme`}
            onClick={() => onValueChange(option.preference)}
          >
            {option.theme ? (
              <span className="theme-option__swatches" aria-hidden="true">
                <span style={{ background: option.theme.colors["bg.primary"] }} />
                <span style={{ background: option.theme.colors["bg.secondary"] }} />
                <span style={{ background: option.theme.colors["accent.primary"] }} />
              </span>
            ) : (
              <Icon size={14} />
            )}
            <span className="theme-option__label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function themePreferenceKey(themePreference: ThemePreference) {
  return themePreference.mode === "system" ? "system" : `theme:${themePreference.themeName}`;
}
