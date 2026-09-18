"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ApiAcquisitionPoint, ApiFunnelStage, ApiOutreachPoint } from "@/types/api";

// Charts read the interface palette rather than carrying their own. These
// were left green when the theme moved to violet, which put mint-coloured
// charts on every dashboard.
const ACCENT = "hsl(258 90% 66%)";
const AMBER = "hsl(38 84% 56%)";
const GRID = "hsl(228 14% 17%)";
const AXIS_TICK = "hsl(228 7% 62%)";

// A single hue stepped in lightness, so the funnel reads as one quantity
// getting smaller rather than as five unrelated categories. Amber marks the
// final stage, which is the one being converted toward.
const FUNNEL_FILLS = [
  "hsl(258 60% 42%)",
  "hsl(258 70% 52%)",
  "hsl(258 82% 60%)",
  "hsl(258 90% 70%)",
  AMBER,
];

const tooltipStyle = {
  background: "hsl(228 16% 11%)",
  border: "1px solid hsl(228 14% 24%)",
  borderRadius: 10,
  fontSize: 12,
  color: "hsl(240 9% 96%)",
};

/** "2026-09-16" -> "Tue 16" — short enough for a dense axis. */
function dayLabel(iso: string) {
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(undefined, { weekday: "short", day: "numeric", timeZone: "UTC" });
}

/** Keeps an all-zero chart from rendering a misleading auto-scaled axis. */
function domainFor(values: number[]): [number, number | "auto"] {
  return values.some((v) => v > 0) ? [0, "auto"] : [0, 4];
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}

export function AcquisitionChart({ data }: { data: ApiAcquisitionPoint[] }) {
  const rows = data.map((point) => ({ ...point, label: dayLabel(point.day) }));
  const isEmpty = rows.every((row) => !row.found && !row.won);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="found" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.4} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="won" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={AMBER} stopOpacity={0.35} />
              <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS_TICK }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: AXIS_TICK }}
            axisLine={false}
            tickLine={false}
            width={36}
            allowDecimals={false}
            domain={domainFor(rows.flatMap((r) => [r.found, r.won]))}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="found" stroke={ACCENT} fill="url(#found)" strokeWidth={2.5} name="Leads added" />
          <Area type="monotone" dataKey="won" stroke={AMBER} fill="url(#won)" strokeWidth={2.5} name="Won" />
        </AreaChart>
      </ResponsiveContainer>
      {isEmpty && <EmptyNote>No leads saved yet — this fills in as you search.</EmptyNote>}
    </div>
  );
}

export function OutreachChart({ data }: { data: ApiOutreachPoint[] }) {
  const rows = data.map((point) => ({ ...point, label: dayLabel(point.day) }));
  const isEmpty = rows.every((row) => !row.sent && !row.replied);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS_TICK }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: AXIS_TICK }}
            axisLine={false}
            tickLine={false}
            width={30}
            allowDecimals={false}
            domain={domainFor(rows.flatMap((r) => [r.sent, r.replied]))}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: GRID }} />
          <Bar dataKey="sent" fill={ACCENT} radius={[3, 3, 0, 0]} name="Sent" />
          <Bar dataKey="replied" fill={AMBER} radius={[3, 3, 0, 0]} name="Replied" />
        </BarChart>
      </ResponsiveContainer>
      {isEmpty && <EmptyNote>No emails sent yet — run a campaign to see results here.</EmptyNote>}
    </div>
  );
}

export function PipelineFunnelChart({ data }: { data: ApiFunnelStage[] }) {
  const isEmpty = data.every((stage) => !stage.value);

  if (isEmpty) {
    // Recharts cannot lay out a funnel where every value is zero, so show the
    // stages as a plain list instead of an invisible chart.
    return (
      <div className="flex h-[220px] flex-col justify-center gap-2">
        {data.map((stage) => (
          <div key={stage.name} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{stage.name}</span>
            <span className="tabular-nums">0</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <FunnelChart>
        <Tooltip contentStyle={tooltipStyle} />
        <Funnel dataKey="value" data={data} isAnimationActive>
          <LabelList position="right" dataKey="name" fill="hsl(240 9% 96%)" stroke="none" fontSize={11} />
          {data.map((stage, index) => (
            <Cell key={stage.name} fill={FUNNEL_FILLS[index % FUNNEL_FILLS.length]} />
          ))}
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
}
