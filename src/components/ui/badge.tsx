import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", {
  variants: {
    variant: {
      default: "bg-primary/10 text-primary ring-primary/20",
      success: "bg-success/10 text-success ring-success/25",
      warning: "bg-warning/10 text-warning ring-warning/25",
      danger: "bg-destructive/10 text-destructive ring-destructive/25",
      info: "bg-brand/10 text-brand ring-brand/25",
      muted: "bg-muted text-muted-foreground ring-border",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
