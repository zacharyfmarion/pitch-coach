import type { ReactNode } from "react";
import { Card } from "./Card";

export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="empty-state" variant="subtle" padding="lg">
      {icon ? <div className="empty-state__icon" aria-hidden="true">{icon}</div> : null}
      <div className="empty-state__copy">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </Card>
  );
}
