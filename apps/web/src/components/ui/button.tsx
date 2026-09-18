import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * One accent button per view, at most.
 *
 * On a near-black interface the eye goes straight to the brightest thing on
 * screen, so `default` is reserved for the single action a screen exists to
 * perform - run the search, save the lead. Everything else is `secondary`,
 * `outline` or `ghost`, which is what keeps the accent meaningful.
 */
const buttonVariants = cva(
  "press relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-brand text-brand-ink font-semibold shadow-accent hover:brightness-[1.08] hover:shadow-[0_8px_30px_-8px_hsl(var(--glow-strong)/0.95)]",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:border-border-strong hover:bg-accent",
        outline:
          "border border-border bg-transparent text-foreground hover:border-border-strong hover:bg-accent",
        ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
        destructive:
          "bg-destructive/90 text-destructive-foreground hover:bg-destructive",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 rounded-sm px-3 text-xs",
        lg: "h-11 rounded-lg px-6 text-[15px]",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8 rounded-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
