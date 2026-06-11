import type { HTMLAttributes, ReactNode } from "react";

export interface DropzoneProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  privacyNote?: ReactNode;
  tone?: "accent" | "song";
  isActive?: boolean;
}

export function Dropzone({
  icon,
  title,
  description,
  action,
  privacyNote,
  tone = "song",
  isActive = false,
  className = "",
  ...props
}: DropzoneProps) {
  return (
    <div
      className={`dropzone dropzone--${tone}${isActive ? " dropzone--active" : ""} ${className}`.trim()}
      {...props}
    >
      {icon ? <div className="dropzone__icon" aria-hidden="true">{icon}</div> : null}
      <div className="dropzone__copy">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="dropzone__action">{action}</div> : null}
      {privacyNote ? <div className="dropzone__privacy">{privacyNote}</div> : null}
    </div>
  );
}
