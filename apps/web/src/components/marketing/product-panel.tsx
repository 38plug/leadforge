import { Search, TrendingUp, Target } from "lucide-react";

const ROWS = [
  { company: "Bella Vista Ristorante", niche: "Restaurant · Miami", score: 94, status: "No website" },
  { company: "Zahnarztpraxis Mitte", niche: "Dentist · Berlin", score: 88, status: "No website" },
  { company: "The Gentleman's Cut", niche: "Barber · London", score: 81, status: "Outdated" },
  { company: "Café Lumière", niche: "Café · Paris", score: 76, status: "No website" },
];

export function ProductPanel() {
  return (
    <div className="panel-float relative w-full max-w-[340px]">
      {/* Glow behind panel */}
      <div
        className="pointer-events-none absolute -inset-12 -z-10 rounded-3xl blur-[80px]"
        style={{
          background: "radial-gradient(circle, hsl(var(--glow-strong) / 0.12), transparent 60%)",
          opacity: 0.4,
        }}
      />

      {/* Panel frame */}
      <div className="glass-card-static overflow-hidden rounded-2xl border border-white/[0.05] bg-[#080808]/90 shadow-[0_0_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white/8" />
            <span className="h-2 w-2 rounded-full bg-white/8" />
            <span className="h-2 w-2 rounded-full bg-white/8" />
          </div>
          <div className="ml-2 flex flex-1 items-center gap-1.5 rounded-md bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/25">
            <Search className="h-2.5 w-2.5" />
            app.leadforge.io
          </div>
        </div>

        {/* Score header */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-white/25">Lead Score</p>
              <p className="mt-1 text-3xl font-bold text-gradient-brand">94</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/[0.06]">
              <Target className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-white/[0.04] bg-white/[0.015] px-2.5 py-1.5">
            <TrendingUp className="h-3 w-3 text-primary" />
            <span className="text-[9px] font-medium text-white/40">+12.4% this week</span>
          </div>
        </div>

        {/* Lead list */}
        <div className="space-y-1 px-4 pb-4">
          <p className="px-0.5 pb-1 text-[8px] font-semibold uppercase tracking-[0.15em] text-white/20">Opportunities</p>
          {ROWS.map((row) => (
            <div
              key={row.company}
              className="flex items-center justify-between rounded-lg border border-white/[0.03] bg-white/[0.01] px-3 py-2 transition-colors hover:bg-white/[0.03]"
            >
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-white/75">{row.company}</p>
                <p className="text-[9px] text-white/25">{row.niche}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-amber-500/10 bg-amber-500/5 px-1.5 py-0.5 text-[8px] font-medium text-amber-300/60">
                  {row.status}
                </span>
                <span className="rounded-md bg-gradient-brand px-1.5 py-0.5 text-[9px] font-bold text-brand-ink">
                  {row.score}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
