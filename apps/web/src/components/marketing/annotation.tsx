/**
 * Technical annotation — tiny uppercase label with optional line.
 * Used throughout the composition for data/system feel.
 */
export function Annotation({
  label,
  line,
  className = "",
  delay = 0,
}: {
  label: string;
  line?: boolean;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={`cinematic-annotation flex items-center gap-2 ${className}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/[0.15]">
        {label}
      </span>
      {line && (
        <span className="h-px flex-1 bg-white/[0.06]" />
      )}
    </div>
  );
}

/**
 * Floating annotation with connecting dot + line.
 * Positioned absolutely around the composition.
 */
export function FloatingAnnotation({
  label,
  value,
  top,
  left,
  right,
  bottom,
  delay = 0,
  dotColor,
}: {
  label: string;
  value?: string;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  delay?: number;
  dotColor?: string;
}) {
  return (
    <div
      className="cinematic-annotation pointer-events-none absolute hidden lg:block"
      style={{ top, left, right, bottom, animationDelay: `${delay}s` }}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: dotColor || "hsl(82 100% 61% / 0.35)",
            boxShadow: `0 0 6px ${dotColor || "hsl(82 100% 61% / 0.2)"}`,
          }}
        />
        <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/[0.18]">
          {label}
        </span>
        {value && (
          <>
            <span className="h-px w-4 bg-white/[0.08]" />
            <span className="text-[8px] font-bold tabular-nums tracking-wider text-white/[0.25]">
              {value}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
