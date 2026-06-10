import type { ReactNode } from "react";
import { Card } from "./Card";

export function StatCard({
  icon,
  label,
  value,
  unit,
  detail,
  trend,
  tone = "neutral"
}: {
  icon?: ReactNode;
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  detail?: ReactNode;
  trend?: ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "song";
}) {
  return (
    <Card className="stat-card" tone={tone} padding="md">
      <div className="stat-card__label">
        {icon ? <span className="stat-card__icon" aria-hidden="true">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div className="stat-card__body">
        <div className="stat-card__value">
          {value}
          {unit ? <span>{unit}</span> : null}
        </div>
        {trend ? <div className="stat-card__trend">{trend}</div> : null}
      </div>
      {detail ? <div className="stat-card__detail">{detail}</div> : null}
    </Card>
  );
}
