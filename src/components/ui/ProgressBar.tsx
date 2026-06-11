import * as Progress from "@radix-ui/react-progress";
import type { ComponentPropsWithoutRef } from "react";

export interface ProgressBarProps
  extends Omit<ComponentPropsWithoutRef<typeof Progress.Root>, "value" | "max"> {
  value: number | null;
  max?: number;
  tone?: "accent" | "success" | "warning" | "song";
}

export function ProgressBar({
  value,
  max = 100,
  tone = "accent",
  className = "",
  ...props
}: ProgressBarProps) {
  const normalizedValue = value === null ? null : clamp(value, 0, max);
  const percent = normalizedValue === null || max <= 0 ? 0 : (normalizedValue / max) * 100;

  return (
    <Progress.Root
      value={normalizedValue}
      max={max}
      className={`ui-progress ui-progress--${tone} ${className}`.trim()}
      {...props}
    >
      <Progress.Indicator
        className="ui-progress__indicator"
        style={{ transform: `translateX(-${100 - percent}%)` }}
      />
    </Progress.Root>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
