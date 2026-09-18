"use client";

import { useId } from "react";

interface LogoMarkProps {
  size?: number;
  className?: string;
  /** Draw the dark rounded tile behind the mark, as in the app icon. */
  tile?: boolean;
}

/**
 * The LeadForge mark: an S built from two opposing arcs, drawn as glowing
 * tubes.
 *
 * Each arc is stroked three times - a blurred copy for the bloom, the violet
 * body, then a short lime highlight where the light catches. That order is
 * what makes it read as a lit tube rather than a coloured line, and it is why
 * the highlight is a separate short arc instead of a gradient stop.
 *
 * Drawn rather than bitmapped so it stays sharp from a 16px favicon to a
 * marketing header, and so the glow can follow the accent token.
 */
export function LogoMark({ size = 30, className, tile = false }: LogoMarkProps) {
  const uid = useId().replace(/:/g, "");
  const body = `body-${uid}`;
  const bloom = `bloom-${uid}`;
  const soft = `soft-${uid}`;
  const tileFill = `tile-${uid}`;

  // Two circles of equal radius, stacked so their arcs meet in the middle.
  const r = 19;
  const topCy = 34;
  const bottomCy = 66;
  const circumference = 2 * Math.PI * r;
  // ~68% of the ring is drawn; the gap is what opens each C.
  const visible = circumference * 0.68;
  const dash = `${visible.toFixed(1)} ${(circumference - visible).toFixed(1)}`;
  // A short bright segment, positioned where the light would catch.
  const highlight = `${(circumference * 0.17).toFixed(1)} ${(circumference * 0.83).toFixed(1)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      role="img"
      aria-label="LeadForge"
    >
      <defs>
        <linearGradient id={body} x1="20" y1="14" x2="80" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C4B5FD" />
          <stop offset="35%" stopColor="#A78BFA" />
          <stop offset="70%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <radialGradient id={bloom} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
        </radialGradient>
        <filter id={soft} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <linearGradient id={tileFill} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#12141B" />
          <stop offset="100%" stopColor="#0B0C11" />
        </linearGradient>
      </defs>

      {tile && <rect x="0" y="0" width="100" height="100" rx="26" fill={`url(#${tileFill})`} />}

      {/* Ambient bloom, sitting behind everything. */}
      <circle cx="50" cy="50" r="30" fill={`url(#${bloom})`} filter={`url(#${soft})`} />

      {/* --- upper arc, opening toward the lower right --- */}
      <g transform="rotate(-24 50 34)">
        <circle
          cx="50"
          cy={topCy}
          r={r}
          stroke="#8B5CF6"
          strokeWidth="11"
          strokeDasharray={dash}
          strokeLinecap="round"
          filter={`url(#${soft})`}
          opacity="0.75"
        />
        <circle
          cx="50"
          cy={topCy}
          r={r}
          stroke={`url(#${body})`}
          strokeWidth="10"
          strokeDasharray={dash}
          strokeLinecap="round"
        />
        <circle
          cx="50"
          cy={topCy}
          r={r}
          stroke="#D9F99D"
          strokeWidth="3.5"
          strokeDasharray={highlight}
          strokeDashoffset={-circumference * 0.08}
          strokeLinecap="round"
          opacity="0.95"
        />
      </g>

      {/* --- lower arc, opening toward the upper left --- */}
      <g transform="rotate(156 50 66)">
        <circle
          cx="50"
          cy={bottomCy}
          r={r}
          stroke="#8B5CF6"
          strokeWidth="11"
          strokeDasharray={dash}
          strokeLinecap="round"
          filter={`url(#${soft})`}
          opacity="0.75"
        />
        <circle
          cx="50"
          cy={bottomCy}
          r={r}
          stroke={`url(#${body})`}
          strokeWidth="10"
          strokeDasharray={dash}
          strokeLinecap="round"
        />
        <circle
          cx="50"
          cy={bottomCy}
          r={r}
          stroke="#D9F99D"
          strokeWidth="3.5"
          strokeDasharray={highlight}
          strokeDashoffset={-circumference * 0.08}
          strokeLinecap="round"
          opacity="0.95"
        />
      </g>
    </svg>
  );
}
