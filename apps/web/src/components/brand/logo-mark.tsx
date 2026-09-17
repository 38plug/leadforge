"use client";

import { useId } from "react";

interface LogoMarkProps {
  size?: number;
  className?: string;
}

const R_MAIN = 27;
const R_ACCENT = 12;
const CIRC_MAIN = 2 * Math.PI * R_MAIN;
const CIRC_ACCENT = 2 * Math.PI * R_ACCENT;

/** visible/gap arc lengths for a ring open on ~300° of its circumference */
function ringDash(circumference: number, visibleDeg: number) {
  const visible = circumference * (visibleDeg / 360);
  const gap = circumference - visible;
  return `${visible.toFixed(1)} ${gap.toFixed(1)}`;
}

/**
 * The LeadForge glow mark — two glossy, tube-like rings (a large ring with
 * a smaller orbiting accent, echoing a forge spark caught mid-arc) rendered
 * with layered gradients, a specular highlight streak, and a soft blurred
 * bloom behind the crisp shape, evoking brushed glass/chrome under a green
 * light rather than a flat app icon.
 */
export function LogoMark({ size = 30, className }: LogoMarkProps) {
  const uid = useId().replace(/:/g, "");
  const tube = `tube-${uid}`;
  const glow = `glow-${uid}`;
  const blur = `blur-${uid}`;

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
        <linearGradient id={tube} x1="18" y1="12" x2="82" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D4FFB0" />
          <stop offset="28%" stopColor="hsl(var(--glow-strong))" />
          <stop offset="65%" stopColor="hsl(150 70% 28%)" />
          <stop offset="100%" stopColor="hsl(150 60% 10%)" />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--glow-strong))" stopOpacity="0.85" />
          <stop offset="100%" stopColor="hsl(var(--glow-strong))" stopOpacity="0" />
        </radialGradient>
        <filter id={blur} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
      </defs>

      {/* ambient bloom */}
      <circle cx="50" cy="46" r="36" fill={`url(#${glow})`} filter={`url(#${blur})`} opacity="0.5" />

      {/* main ring — blurred bloom copy, then crisp tube */}
      <circle
        cx="50"
        cy="40"
        r={R_MAIN}
        stroke="hsl(var(--glow-strong))"
        strokeWidth="12"
        strokeDasharray={ringDash(CIRC_MAIN, 300)}
        strokeDashoffset="40"
        strokeLinecap="round"
        transform="rotate(20 50 40)"
        filter={`url(#${blur})`}
        opacity="0.55"
      />
      <circle
        cx="50"
        cy="40"
        r={R_MAIN}
        stroke={`url(#${tube})`}
        strokeWidth="12"
        strokeDasharray={ringDash(CIRC_MAIN, 300)}
        strokeDashoffset="40"
        strokeLinecap="round"
        transform="rotate(20 50 40)"
      />
      {/* specular highlight streak */}
      <circle
        cx="50"
        cy="40"
        r={R_MAIN}
        stroke="#EFFFEA"
        strokeWidth="3"
        strokeDasharray={ringDash(CIRC_MAIN, 32)}
        strokeDashoffset="8"
        strokeLinecap="round"
        transform="rotate(20 50 40)"
        opacity="0.9"
      />

      {/* accent ring (forward-kicked spark, echoing the L's forward motion) */}
      <circle
        cx="34"
        cy="71"
        r={R_ACCENT}
        stroke={`url(#${tube})`}
        strokeWidth="8"
        strokeDasharray={ringDash(CIRC_ACCENT, 300)}
        strokeDashoffset="8"
        strokeLinecap="round"
        transform="rotate(-25 34 71)"
      />
      <circle
        cx="34"
        cy="71"
        r={R_ACCENT}
        stroke="#EFFFEA"
        strokeWidth="2"
        strokeDasharray={ringDash(CIRC_ACCENT, 28)}
        strokeDashoffset="2"
        strokeLinecap="round"
        transform="rotate(-25 34 71)"
        opacity="0.9"
      />
    </svg>
  );
}
