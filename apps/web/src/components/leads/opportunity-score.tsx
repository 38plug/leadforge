"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The opportunity score is the product's core judgement, so it is never
 * presented as a bare number a user has to trust.
 *
 * `ScoreRing` shows the figure; `ScoreBreakdown` shows the factors that
 * produced it. Both take their values from the API's own scoring service -
 * nothing here invents or re-weights a factor client-side.
 */

export interface ScoreFactor {
  label: string;
  points: number;
}

function toneFor(score: number) {
  // Bands match how a user acts on them: chase now, worth a look, probably not.
  if (score >= 80) return { stroke: "hsl(var(--primary))", text: "text-primary" };
  if (score >= 60) return { stroke: "hsl(var(--warning))", text: "text-warning" };
  return { stroke: "hsl(var(--subtle-foreground))", text: "text-subtle-foreground" };
}

export function ScoreRing({
  score,
  size = 44,
  showLabel = false,
}: {
  score: number;
  size?: number;
  showLabel?: boolean;
}) {
  const tone = toneFor(score);
  const stroke = size < 40 ? 3 : 3.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Opportunity score ${clamped} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span
        className={cn(
          "numeric absolute font-semibold",
          tone.text,
          size < 40 ? "text-xs" : "text-sm"
        )}
      >
        {clamped}
      </span>
      {showLabel && <span className="sr-only">out of 100</span>}
    </div>
  );
}

/** Compact inline figure, for dense table cells where a ring is too heavy. */
export function ScorePill({ score }: { score: number }) {
  const tone = toneFor(score);
  return (
    <span
      className={cn(
        "numeric inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded-sm border px-1.5 text-xs font-semibold",
        score >= 80
          ? "border-primary/25 bg-primary/12 text-primary"
          : score >= 60
          ? "border-warning/25 bg-warning/12 text-warning"
          : "border-border bg-muted text-muted-foreground",
        tone.text === "" && ""
      )}
    >
      {score}
    </span>
  );
}

/**
 * Expandable explanation. Collapsed by default so a list stays scannable,
 * because the explanation matters at the moment someone questions the number
 * rather than continuously.
 */
export function ScoreBreakdown({
  score,
  factors,
  summary,
}: {
  score: number;
  factors: ScoreFactor[];
  summary?: string;
}) {
  const [open, setOpen] = useState(false);
  const maxPoints = Math.max(...factors.map((f) => Math.abs(f.points)), 1);

  return (
    <div className="rounded-lg border border-border bg-background/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <ScoreRing score={score} size={48} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Opportunity score</span>
          <span className="block text-xs text-muted-foreground">
            {factors.length} factor{factors.length === 1 ? "" : "s"} &middot;{" "}
            {open ? "Hide" : "Show"} how this was calculated
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="animate-fade-in border-t border-border px-4 pb-4 pt-3">
          <ul className="flex flex-col gap-2.5">
            {factors.map((factor) => (
              <li key={factor.label} className="flex items-center gap-3">
                <span className="w-36 shrink-0 truncate text-xs text-muted-foreground">
                  {factor.label}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary/70"
                    style={{ width: `${(Math.abs(factor.points) / maxPoints) * 100}%` }}
                  />
                </span>
                <span className="numeric w-10 shrink-0 text-right text-xs font-medium text-foreground">
                  {factor.points > 0 ? "+" : ""}
                  {factor.points}
                </span>
              </li>
            ))}
          </ul>

          {summary && (
            <p className="mt-3.5 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
              {summary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
