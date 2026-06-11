import type { ReactNode } from "react";

export function CoachBubble({
  icon,
  children,
  tone = "accent"
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: "accent" | "success" | "warning" | "info";
}) {
  return (
    <div className={`coach-bubble coach-bubble--${tone}`}>
      {icon ? <div className="coach-bubble__icon" aria-hidden="true">{icon}</div> : null}
      <div className="coach-bubble__message">{children}</div>
    </div>
  );
}
