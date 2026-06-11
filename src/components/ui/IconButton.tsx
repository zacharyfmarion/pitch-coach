import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./Tooltip";
import { CONTROL_RADIUS_CLASS, ICON_CONTROL_SIZE_CLASSES } from "./controlStyles";

const iconButton = cva(["ui-button", "ui-button--icon", CONTROL_RADIUS_CLASS].join(" "), {
  variants: {
    variant: {
      default: "ui-button--ghost",
      toolbar: "ui-button--secondary",
      primary: "ui-button--primary",
      song: "ui-button--song",
      danger: "ui-button--danger"
    },
    size: ICON_CONTROL_SIZE_CLASSES
  },
  defaultVariants: {
    variant: "default",
    size: "md"
  }
});

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButton> {
  isActive?: boolean;
  tooltipSide?: "top" | "right" | "bottom" | "left";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant,
      size,
      isActive,
      className = "",
      type = "button",
      title,
      tooltipSide,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    const accessibleLabel = ariaLabel ?? (typeof title === "string" ? title : undefined);
    const button = (
      <button
        ref={ref}
        type={type}
        className={iconButton({ variant, size, className })}
        data-active={isActive || undefined}
        aria-label={accessibleLabel}
        {...props}
      />
    );

    if (!title) {
      return button;
    }

    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side={tooltipSide}>{title}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);

IconButton.displayName = "IconButton";
