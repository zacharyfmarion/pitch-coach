import { forwardRef, useMemo } from "react";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

export type DropdownOption<Value extends string | number> = {
  value: Value;
  label: string;
  disabled?: boolean;
};

type DropdownProps<Value extends string | number> = {
  value: Value;
  options: readonly DropdownOption<Value>[];
  onValueChange: (value: Value) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
};

export function Dropdown<Value extends string | number>({
  value,
  options,
  onValueChange,
  ariaLabel,
  disabled = false,
  className,
  triggerClassName
}: DropdownProps<Value>) {
  const selectedValue = String(value);
  const optionByValue = useMemo(
    () => new Map(options.map((option) => [String(option.value), option])),
    [options]
  );

  return (
    <Select.Root
      value={selectedValue}
      onValueChange={(nextValue) => {
        const option = optionByValue.get(nextValue);
        if (option) {
          onValueChange(option.value);
        }
      }}
      disabled={disabled}
    >
      <Select.Trigger
        className={["dropdown-trigger", triggerClassName].filter(Boolean).join(" ")}
        aria-label={ariaLabel}
      >
        <Select.Value />
        <Select.Icon className="dropdown-trigger-icon" asChild>
          <ChevronDown size={17} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className={["dropdown-content", className].filter(Boolean).join(" ")} position="popper">
          <Select.Viewport className="dropdown-viewport">
            {options.map((option) => (
              <DropdownItem key={String(option.value)} value={String(option.value)} disabled={option.disabled}>
                {option.label}
              </DropdownItem>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

const DropdownItem = forwardRef<HTMLDivElement, Select.SelectItemProps>(
  ({ children, className, ...props }, ref) => (
    <Select.Item ref={ref} className={["dropdown-item", className].filter(Boolean).join(" ")} {...props}>
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator className="dropdown-item-indicator">
        <Check size={15} />
      </Select.ItemIndicator>
    </Select.Item>
  )
);

DropdownItem.displayName = "DropdownItem";
