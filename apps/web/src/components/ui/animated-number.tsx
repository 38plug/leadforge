"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts up to `value` on mount and whenever it changes.
 *
 * Renders the final value immediately when the user prefers reduced
 * motion, and formats through `format` so currency and plain counts share
 * one component.
 */
export function AnimatedNumber({
  value,
  format = (n: number) => Math.round(n).toLocaleString(),
  durationMs = 750,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduced || durationMs <= 0) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    const delta = value - from;
    if (delta === 0) return;

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Ease-out cubic: fast first, settling at the end.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + delta * eased);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      // Leave the ref at the target so an interrupted run does not replay.
      fromRef.current = value;
    };
  }, [value, durationMs]);

  return <span className={className}>{format(display)}</span>;
}
