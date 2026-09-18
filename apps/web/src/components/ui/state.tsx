"use client";

import { AlertTriangle, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo-mark";
import { cn } from "@/lib/utils";

/**
 * Loading, empty and error are three different statements and the product
 * treats them that way.
 *
 * The distinction that matters most here: a provider that did not respond is
 * NOT "no businesses found". Telling someone their search returned nothing
 * when the service was down sends them off to re-target a market that was
 * never actually searched.
 */

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="relative">
        <div
          className="animate-breathe absolute -inset-6 rounded-full blur-2xl"
          style={{ background: "radial-gradient(circle, hsl(var(--glow-strong) / 0.3), transparent 70%)" }}
          aria-hidden="true"
        />
        <div className="animate-breathe relative">
          <LogoMark size={32} />
        </div>
      </div>
      <p className="animate-fade-in text-sm text-muted-foreground" role="status">
        {label}
      </p>
    </div>
  );
}

/** Placeholder rows shaped like the content they stand in for. */
export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="shimmer h-11 rounded-md" style={{ animationDelay: `${index * 0.08}s` }} />
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="shimmer h-[104px] rounded-xl"
          style={{ animationDelay: `${index * 0.08}s` }}
        />
      ))}
    </div>
  );
}

/**
 * A step list for work that genuinely has stages, so a long wait shows what
 * is happening rather than a bar inching toward a number nobody chose. The
 * caller passes the step actually in progress; nothing here guesses.
 */
export function ProgressSteps({ steps, activeIndex }: { steps: string[]; activeIndex: number }) {
  return (
    <ul className="flex flex-col gap-2" role="status" aria-live="polite">
      {steps.map((step, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        return (
          <li
            key={step}
            className={cn(
              "flex items-center gap-2.5 text-xs transition-colors",
              done && "text-muted-foreground",
              active && "text-foreground",
              !done && !active && "text-subtle-foreground"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                done && "bg-success",
                active && "animate-breathe bg-primary",
                !done && !active && "bg-border"
              )}
              aria-hidden="true"
            />
            {step}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Something went wrong and we say so. `retryable` comes from the API, which
 * distinguishes a transient upstream outage from a request that will fail
 * the same way every time.
 */
export function ErrorState({
  message,
  onRetry,
  title = "Something went wrong",
  retryable = true,
  secondaryAction,
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
  retryable?: boolean;
  secondaryAction?: React.ReactNode;
}) {
  return (
    <div className="animate-scale-in flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-warning/25 bg-warning/10">
        <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold">{title}</p>
      <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{message}</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {retryable && onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        )}
        {secondaryAction}
      </div>
    </div>
  );
}

/**
 * Empty is an invitation, not a dead end: it names the next useful action
 * instead of reporting the absence of rows.
 */
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
      <div className="relative mb-2">
        <div
          className="absolute -inset-5 rounded-full blur-2xl"
          style={{ background: "radial-gradient(circle, hsl(var(--glow-strong) / 0.14), transparent 70%)" }}
          aria-hidden="true"
        />
        <span className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface">
          <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </span>
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
