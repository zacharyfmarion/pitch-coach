import type { ReactNode } from "react";

export function AppShell({
  sidebar,
  header,
  mobileNav,
  children,
  className = ""
}: {
  sidebar?: ReactNode;
  header?: ReactNode;
  mobileNav?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const shellClassName = [
    "pc-app-shell",
    mobileNav ? "pc-app-shell--with-mobile-nav" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClassName}>
      {sidebar ? <aside className="pc-app-shell__sidebar">{sidebar}</aside> : null}
      <div className="pc-app-shell__main">
        {header ? <div className="pc-app-shell__header">{header}</div> : null}
        <div className="pc-app-shell__content">{children}</div>
      </div>
      {mobileNav ? <div className="pc-app-shell__mobile-nav">{mobileNav}</div> : null}
    </div>
  );
}
