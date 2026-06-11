import type { ReactNode } from "react";
import { SidebarTabs, type SidebarTabItem } from "./SidebarTabs";

export function SidebarNav<Value extends string>({
  brand,
  items,
  activeValue,
  onNavigate,
  footer,
  ariaLabel = "Primary navigation"
}: {
  brand?: ReactNode;
  items: readonly SidebarTabItem<Value>[];
  activeValue: Value;
  onNavigate: (value: Value) => void;
  footer?: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <nav className="sidebar-nav" aria-label={ariaLabel}>
      {brand ? <div className="sidebar-nav__brand">{brand}</div> : null}
      <SidebarTabs
        value={activeValue}
        items={items}
        onValueChange={onNavigate}
        ariaLabel={ariaLabel}
      />
      {footer ? <div className="sidebar-nav__footer">{footer}</div> : null}
    </nav>
  );
}
