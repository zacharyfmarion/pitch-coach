import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

const card = cva("ui-card", {
  variants: {
    variant: {
      default: "ui-card--default",
      elevated: "ui-card--elevated",
      interactive: "ui-card--interactive",
      subtle: "ui-card--subtle",
      dashed: "ui-card--dashed"
    },
    padding: {
      none: "ui-card--pad-none",
      sm: "ui-card--pad-sm",
      md: "ui-card--pad-md",
      lg: "ui-card--pad-lg"
    },
    tone: {
      neutral: "ui-card--neutral",
      accent: "ui-card--accent",
      success: "ui-card--success",
      warning: "ui-card--warning",
      song: "ui-card--song"
    }
  },
  defaultVariants: {
    variant: "default",
    padding: "md",
    tone: "neutral"
  }
});

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof card> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant, padding, tone, className = "", ...props }, ref) => (
    <div ref={ref} className={card({ variant, padding, tone, className })} {...props} />
  )
);

Card.displayName = "Card";

export function CardHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ui-card__header ${className}`.trim()} {...props} />;
}

export function CardContent({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ui-card__content ${className}`.trim()} {...props} />;
}

export function CardFooter({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ui-card__footer ${className}`.trim()} {...props} />;
}

export function CardTitle({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={`ui-card__title ${className}`.trim()} {...props} />;
}

export function CardDescription({ className = "", ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`ui-card__description ${className}`.trim()} {...props} />;
}
