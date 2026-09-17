import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/animated-number";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: number;
  deltaLabel?: string;
  /** When given, the figure counts up to this on mount. */
  numericValue?: number;
  /** Formats `numericValue` during the count-up. Defaults to the raw count. */
  format?: (n: number) => string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaLabel,
  numericValue,
  format,
}: StatCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className="lift group p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <Icon className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:scale-110 group-hover:text-[hsl(var(--glow-strong))]" />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">
        {numericValue !== undefined ? (
          <AnimatedNumber value={numericValue} format={format} />
        ) : (
          value
        )}
      </p>
      {delta !== undefined && (
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-[11px] font-medium",
            positive ? "text-success" : "text-destructive"
          )}
        >
          {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          <span>{Math.abs(delta)}%</span>
          {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
        </div>
      )}
    </Card>
  );
}
