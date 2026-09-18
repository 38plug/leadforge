"use client";

import { useId } from "react";

interface LogoPatternProps {
  /** opacity of the whole tiled layer */
  opacity?: number;
  className?: string;
}

/**
 * The mark, tiled at very low opacity as a background texture.
 *
 * Geometry is kept in step with LogoMark by hand rather than by rendering the
 * component: a <pattern> needs flat shapes, and the mark's blur filters and
 * triple strokes would be repeated for every tile on screen.
 *
 * Never placed behind body text - it has to stay under the contrast floor to
 * read as texture rather than as decoration competing with the words.
 */
export function LogoPattern({ opacity = 0.02, className }: LogoPatternProps) {
  const uid = useId().replace(/:/g, "");
  const pattern = `logo-pattern-${uid}`;

  return (
    <svg className={className} width="100%" height="100%" aria-hidden="true" style={{ opacity }}>
      <defs>
        <pattern
          id={pattern}
          width="150"
          height="150"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-8)"
        >
          {/* Single-stroke version of the two arcs that form the S. */}
          <g transform="translate(40 40) scale(0.42)" stroke="hsl(var(--glow-strong))" fill="none">
            <circle
              cx="50"
              cy="34"
              r="19"
              strokeWidth="10"
              strokeDasharray="81.2 38.2"
              strokeLinecap="round"
              transform="rotate(-24 50 34)"
            />
            <circle
              cx="50"
              cy="66"
              r="19"
              strokeWidth="10"
              strokeDasharray="81.2 38.2"
              strokeLinecap="round"
              transform="rotate(156 50 66)"
            />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${pattern})`} />
    </svg>
  );
}
