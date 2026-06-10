import type { ReactNode } from "react";
import { Chip } from "./Chip";

type StatusPillTone = "idle" | "active" | "success" | "warning" | "danger" | "info";

const toneByStatus = {
  idle: "neutral",
  active: "accent",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info"
} as const;

export function StatusPill({
  tone = "idle",
  children,
  pulse = false
}: {
  tone?: StatusPillTone;
  children: ReactNode;
  pulse?: boolean;
}) {
  return (
    <Chip
      tone={toneByStatus[tone]}
      className={`ui-status-pill${pulse ? " ui-status-pill--pulse" : ""}`}
      aria-live={tone === "active" ? "polite" : undefined}
    >
      <span className="ui-status-pill__dot" aria-hidden="true" />
      {children}
    </Chip>
  );
}
