import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Status badges appear dozens at a time in a lead table, so each is a tinted
 * wash with a coloured label rather than a solid block - solid fills at that
 * density turn a working screen into a set of traffic lights.
 *
 * `signal` is the exception and exists for one case: "no website", the
 * strongest buying signal in the product. It carries a border and a dot so it
 * stands out in a scan without being the only loud thing on screen.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 text-2xs font-medium leading-none transition-colors",
  {
    variants: {
      variant: {
        default: "border-primary/25 bg-primary/12 text-primary",
        secondary: "border-border bg-secondary text-secondary-foreground",
        outline: "border-border text-muted-foreground",
        success: "border-success/25 bg-success/12 text-success",
        warning: "border-warning/25 bg-warning/12 text-warning",
        destructive: "border-destructive/25 bg-destructive/12 text-destructive",
        muted: "border-transparent bg-muted text-muted-foreground",
        signal:
          "border-primary/40 bg-primary/15 text-primary shadow-[0_0_18px_-6px_hsl(var(--glow-strong)/0.6)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Small leading dot, for statuses that benefit from a shape as well as a colour. */
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
