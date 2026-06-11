import * as Tabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

export type SidebarTabItem<Value extends string> = {
  value: Value;
  label: string;
  icon?: ReactNode;
  meta?: ReactNode;
  disabled?: boolean;
};

export function SidebarTabs<Value extends string>({
  value,
  items,
  onValueChange,
  ariaLabel,
  orientation = "vertical",
  className = ""
}: {
  value: Value;
  items: readonly SidebarTabItem<Value>[];
  onValueChange: (value: Value) => void;
  ariaLabel: string;
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  return (
    <Tabs.Root
      value={value}
      onValueChange={(nextValue) => onValueChange(nextValue as Value)}
      orientation={orientation}
      className={`sidebar-tabs sidebar-tabs--${orientation} ${className}`.trim()}
    >
      <Tabs.List className="sidebar-tabs__list" aria-label={ariaLabel}>
        {items.map((item) => (
          <Tabs.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className="sidebar-tabs__trigger"
          >
            {item.icon ? <span className="sidebar-tabs__icon">{item.icon}</span> : null}
            <span className="sidebar-tabs__label">{item.label}</span>
            {item.meta ? <span className="sidebar-tabs__meta">{item.meta}</span> : null}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
