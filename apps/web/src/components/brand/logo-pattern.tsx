"use client";

import { useId } from "react";

interface LogoPatternProps {
  /** opacity of the whole tiled layer */
  opacity?: number;
  className?: string;
}

/**
 * A low-opacity, repeated tiling of the LogoMark rings used as a subtle
 * background texture (a quiet branding cue on marketing surfaces — never
 * behind body text, since it must stay under the contrast floor).
 */
export function LogoPattern({ opacity = 0.02, className }: LogoPatternProps) {
  const uid = useId().replace(/:/g, "");
  const pattern = `logo-pattern-${uid}`;

  return (
    <svg
      className={className}
      width="100%"
      height="100%"
      aria-hidden="true"
      style={{ opacity }}
    >
      <defs>
        <pattern id={pattern} width="150" height="150" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
          <g transform="translate(48 48) scale(0.42)" stroke="hsl(var(--glow-strong))" fill="none">
            <circle cx="50" cy="40" r="27" strokeWidth="10" strokeDasharray="141.4 28.3" strokeDashoffset="40" strokeLinecap="round" transform="rotate(20 50 40)" />
            <circle cx="34" cy="71" r="12" strokeWidth="7" strokeDasharray="62.8 12.6" strokeDashoffset="8" strokeLinecap="round" transform="rotate(-25 34 71)" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${pattern})`} />
    </svg>
  );
}
