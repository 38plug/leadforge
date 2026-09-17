import { AlertTriangle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo-mark";

/**
 * Loading uses the brand mark with a breathing glow rather than a generic
 * spinner, so waiting still feels like part of the product.
 */
export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="relative">
        <div
          className="animate-breathe absolute -inset-6 rounded-full blur-2xl"
          style={{ background: "radial-gradient(circle, hsl(var(--glow-strong) / 0.35), transparent 70%)" }}
          aria-hidden="true"
        />
        <div className="animate-breathe relative">
          <LogoMark size={34} />
        </div>
      </div>
      <p className="animate-fade-in text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/** Placeholder rows that read as "working" while data loads. */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="shimmer h-10 rounded-md" style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="animate-scale-in flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <AlertTriangle className="h-6 w-6 text-destructive" />
      <p className="text-sm font-medium">Something went wrong</p>
      <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="press mt-2">
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="animate-rise-in flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="relative mb-1">
        <div
          className="animate-breathe absolute -inset-4 rounded-full blur-xl"
          style={{ background: "radial-gradient(circle, hsl(var(--glow-strong) / 0.18), transparent 70%)" }}
          aria-hidden="true"
        />
        <Icon className="relative h-8 w-8 text-muted-foreground/60" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
