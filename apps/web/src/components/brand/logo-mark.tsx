"use client";

import { useId } from "react";

interface LogoMarkProps {
  size?: number;
  className?: string;
  tile?: boolean;
}

/**
 * The LeadForge mark: an S built from two opposing arcs, drawn as glowing
 * tubes. Electric lime accent on a deep black field.
 */
export function LogoMark({ size = 30, className, tile = false }: LogoMarkProps) {
  const uid = useId().replace(/:/g, "");
  const body = `body-${uid}`;
  const bloom = `bloom-${uid}`;
  const soft = `soft-${uid}`;
  const tileFill = `tile-${uid}`;

  const r = 19;
  const topCy = 34;
  const bottomCy = 66;
  const circumference = 2 * Math.PI * r;
  const visible = circumference * 0.68;
  const dash = `${visible.toFixed(1)} ${(circumference - visible).toFixed(1)}`;
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
          <stop offset="0%" stopColor="#E2FF8C" />
          <stop offset="35%" stopColor="#C8FF3D" />
          <stop offset="70%" stopColor="#A8E600" />
          <stop offset="100%" stopColor="#8BC600" />
        </linearGradient>
        <radialGradient id={bloom} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#C8FF3D" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#C8FF3D" stopOpacity="0" />
        </radialGradient>
        <filter id={soft} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <linearGradient id={tileFill} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0C0C0D" />
          <stop offset="100%" stopColor="#050505" />
        </linearGradient>
      </defs>

      {tile && <rect x="0" y="0" width="100" height="100" rx="26" fill={`url(#${tileFill})`} />}

      <circle cx="50" cy="50" r="30" fill={`url(#${bloom})`} filter={`url(#${soft})`} />

      {/* Upper arc */}
      <g transform="rotate(-24 50 34)">
        <circle
          cx="50"
          cy={topCy}
          r={r}
          stroke="#C8FF3D"
          strokeWidth="11"
          strokeDasharray={dash}
          strokeLinecap="round"
          filter={`url(#${soft})`}
          opacity="0.6"
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
          stroke="#F5FFD0"
          strokeWidth="3.5"
          strokeDasharray={highlight}
          strokeDashoffset={-circumference * 0.08}
          strokeLinecap="round"
          opacity="0.9"
        />
      </g>

      {/* Lower arc */}
      <g transform="rotate(156 50 66)">
        <circle
          cx="50"
          cy={bottomCy}
          r={r}
          stroke="#C8FF3D"
          strokeWidth="11"
          strokeDasharray={dash}
          strokeLinecap="round"
          filter={`url(#${soft})`}
          opacity="0.6"
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
          stroke="#F5FFD0"
          strokeWidth="3.5"
          strokeDasharray={highlight}
          strokeDashoffset={-circumference * 0.08}
          strokeLinecap="round"
          opacity="0.9"
        />
      </g>
    </svg>
  );
}
