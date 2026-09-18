"use client";

import Link from "next/link";
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";

/**
 * A compact figure, not a poster.
 *
 * Five of these sit in a row, so the number carries the weight and everything
 * around it stays quiet. The sparkline is drawn only when real history is
 * supplied - an invented trend line on a real metric would be a lie in the
 * one place a user is least likely to check.
 */
export function MetricCard({
  label,
  value,
  icon: Icon,
  change,
  changeLabel,
  series,
  href,
  accent,
}: {
  label: string;
  value: number;
  icon?: LucideIcon;
  /** Percentage change; omit when there is nothing real to compare against. */
  change?: number | null;
  changeLabel?: string;
  /** Recent values, oldest first. Omit and no sparkline is drawn. */
  series?: number[];
  href?: string;
  /** Marks the metric this screen wants acted on. At most one per row. */
  accent?: boolean;
}) {
  const positive = (change ?? 0) >= 0;
  const TrendIcon = positive ? TrendingUp : TrendingDown;

  const body = (
    <div
      className={cn(
        "surface surface-interactive relative h-full overflow-hidden rounded-xl p-4",
        accent && "border-primary/25"
      )}
    >
      {accent && (
        <span
          className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full blur-2xl"
          style={{ background: "hsl(var(--glow-strong) / 0.18)" }}
          aria-hidden="true"
        />
      )}

      <div className="relative flex items-center justify-between gap-2">
        <span className="label-caps truncate">{label}</span>
        {Icon && (
          <Icon
            className={cn("h-4 w-4 shrink-0", accent ? "text-primary" : "text-subtle-foreground")}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="relative mt-2.5 flex items-end justify-between gap-3">
        <span className="numeric text-2xl font-semibold leading-none">
          <AnimatedNumber value={value} />
        </span>
        {series && series.length > 1 && <Sparkline values={series} accent={accent} />}
      </div>

      {typeof change === "number" && (
        <p className="relative mt-2 flex items-center gap-1 text-2xs">
          <TrendIcon
            className={cn("h-3 w-3", positive ? "text-success" : "text-destructive")}
            aria-hidden="true"
          />
          <span className={cn("numeric font-medium", positive ? "text-success" : "text-destructive")}>
            {positive ? "+" : ""}
            {change.toFixed(1)}%
          </span>
          {changeLabel && <span className="truncate text-subtle-foreground">{changeLabel}</span>}
        </p>
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Minimal trend line: shape only, no axes, no grid, nothing to read off it. */
function Sparkline({ values, accent }: { values: number[]; accent?: boolean }) {
  const width = 64;
  const height = 24;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="shrink-0 overflow-visible" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={accent ? "hsl(var(--primary))" : "hsl(var(--subtle-foreground))"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={accent ? 0.9 : 0.5}
      />
    </svg>
  );
}
