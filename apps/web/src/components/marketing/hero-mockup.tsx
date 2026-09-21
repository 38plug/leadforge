import { Search, TrendingUp } from "lucide-react";

const STATS = [
  { label: "Leads Found", value: "2,481", accent: false },
  { label: "Opportunity Score", value: "94", accent: true },
  { label: "Pipeline Value", value: "$38.5K", accent: false },
];

const ROWS = [
  { company: "Bella Vista Ristorante", niche: "Restaurant · Miami", score: 94, website: "No website" },
  { company: "Zahnarztpraxis Mitte", niche: "Dentist · Berlin", score: 88, website: "No website" },
  { company: "The Gentleman's Cut", niche: "Barber · London", score: 81, website: "No website" },
];

export function HeroMockup() {
  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute -inset-16 -z-10 rounded-[40px] opacity-60 blur-[80px]"
        style={{ background: "radial-gradient(circle, hsl(var(--glow-strong) / 0.4), transparent 70%)" }}
      />
      <div className="animate-float glow-ring rounded-2xl border border-white/[0.06] bg-[#0A0A0B]/95 shadow-2xl shadow-black/70">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-white/[0.05] px-5 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <div className="ml-3 flex flex-1 items-center gap-2 rounded-md bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/35">
            <Search className="h-3 w-3" />
            app.leadforge.io/dashboard
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 p-5">
          {STATS.map((s) => (
            <div
              key={s.label}
              className={`rounded-lg border p-3 ${
                s.accent
                  ? "border-primary/30 bg-primary/[0.06]"
                  : "border-white/[0.05] bg-white/[0.02]"
              }`}
            >
              <p className="text-[9px] font-medium uppercase tracking-wide text-white/35">{s.label}</p>
              <p className={`mt-1.5 text-lg font-semibold ${s.accent ? "text-gradient-brand" : "text-white"}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Trending bar */}
        <div className="px-5 pb-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-medium text-white/60">Lead acquisition trending up 12.4% this week</span>
          </div>
        </div>

        {/* Lead rows */}
        <div className="space-y-1.5 px-5 pb-5">
          <p className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-white/30">Top opportunities</p>
          {ROWS.map((row) => (
            <div
              key={row.company}
              className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2 transition-colors hover:bg-white/[0.04]"
            >
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-white/85">{row.company}</p>
                <p className="text-[10.5px] text-white/35">{row.niche}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-red-500/15 bg-red-500/8 px-2 py-0.5 text-[9.5px] font-medium text-red-300/80">
                  {row.website}
                </span>
                <span className="rounded-md bg-gradient-brand px-2 py-0.5 text-[10.5px] font-bold text-brand-ink">
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
