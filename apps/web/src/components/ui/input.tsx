import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Inputs sit *into* the page rather than on top of it: the fill is darker
 * than the panel around them, which is what makes a form read as a set of
 * wells instead of a stack of cards.
 */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background/60 px-3 text-sm text-foreground transition-colors",
          "placeholder:text-subtle-foreground",
          "hover:border-border-strong",
          "focus:border-primary/50 focus:bg-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

/** Matches Input, for the `select` elements used throughout the filter panels. */
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-9 w-full cursor-pointer rounded-md border border-input bg-background/60 px-3 text-sm text-foreground transition-colors",
        "hover:border-border-strong focus:border-primary/50 focus:bg-background",
        className
      )}
      {...props}
    />
  )
);
Select.displayName = "Select";

export { Input, Select };
