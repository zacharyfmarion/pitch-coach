import type { ReactNode } from "react";
import { Card, type CardProps } from "./Card";

export function StatCard({
  className = "",
  icon,
  label,
  value,
  unit,
  detail,
  trend,
  tone = "neutral",
  variant = "default",
  padding = "md",
  valueClassName = ""
}: {
  className?: string;
  icon?: ReactNode;
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  detail?: ReactNode;
  trend?: ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "song";
  variant?: CardProps["variant"];
  padding?: CardProps["padding"];
  valueClassName?: string;
}) {
  return (
    <Card className={`stat-card ${className}`.trim()} tone={tone} variant={variant} padding={padding}>
      <div className="stat-card__label">
        {icon ? <span className="stat-card__icon" aria-hidden="true">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div className="stat-card__body">
        <div className={`stat-card__value ${valueClassName}`.trim()}>
          {value}
          {unit ? <span>{unit}</span> : null}
        </div>
        {trend ? <div className="stat-card__trend">{trend}</div> : null}
      </div>
      {detail ? <div className="stat-card__detail">{detail}</div> : null}
    </Card>
  );
}
