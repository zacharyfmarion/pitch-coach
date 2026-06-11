import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

const chip = cva("ui-chip", {
  variants: {
    tone: {
      neutral: "ui-chip--neutral",
      accent: "ui-chip--accent",
      success: "ui-chip--success",
      warning: "ui-chip--warning",
      danger: "ui-chip--danger",
      info: "ui-chip--info",
      song: "ui-chip--song"
    },
    size: {
      sm: "ui-chip--sm",
      md: "ui-chip--md"
    }
  },
  defaultVariants: {
    tone: "neutral",
    size: "md"
  }
});

export interface ChipProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chip> {}

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(
  ({ tone, size, className = "", ...props }, ref) => (
    <span ref={ref} className={chip({ tone, size, className })} {...props} />
  )
);

Chip.displayName = "Chip";
