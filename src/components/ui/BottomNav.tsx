import * as Tabs from "@radix-ui/react-tabs";
import { type SidebarTabItem } from "./SidebarTabs";

export function BottomNav<Value extends string>({
  items,
  activeValue,
  onNavigate,
  ariaLabel = "Mobile navigation"
}: {
  items: readonly SidebarTabItem<Value>[];
  activeValue: Value;
  onNavigate: (value: Value) => void;
  ariaLabel?: string;
}) {
  return (
    <nav className="bottom-nav" aria-label={ariaLabel}>
      <Tabs.Root
        value={activeValue}
        onValueChange={(nextValue) => onNavigate(nextValue as Value)}
        orientation="horizontal"
        className="bottom-nav__tabs"
      >
        <Tabs.List className="bottom-nav__list" aria-label={ariaLabel}>
          {items.map((item) => (
            <Tabs.Trigger
              key={item.value}
              value={item.value}
              disabled={item.disabled}
              className="bottom-nav__trigger"
            >
              {item.icon ? <span className="bottom-nav__icon">{item.icon}</span> : null}
              <span className="bottom-nav__label">{item.label}</span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs.Root>
    </nav>
  );
}
