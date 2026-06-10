import type { ReactNode } from "react";

export function AppShell({
  sidebar,
  header,
  children,
  className = ""
}: {
  sidebar?: ReactNode;
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`pc-app-shell ${className}`.trim()}>
      {sidebar ? <aside className="pc-app-shell__sidebar">{sidebar}</aside> : null}
      <div className="pc-app-shell__main">
        {header ? <div className="pc-app-shell__header">{header}</div> : null}
        <div className="pc-app-shell__content">{children}</div>
      </div>
    </div>
  );
}
