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
      {/* Glow behind mockup */}
      <div
        className="pointer-events-none absolute -inset-20 -z-10 rounded-[50px] blur-[100px]"
        style={{
          background: "radial-gradient(circle, hsl(var(--glow-strong) / 0.25), transparent 60%)",
          opacity: 0.5,
        }}
      />

      {/* Mockup card */}
      <div className="animate-float rounded-2xl border border-white/[0.05] bg-[#080808]/80 shadow-[0_0_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/8" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/8" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/8" />
          <div className="ml-3 flex flex-1 items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/30">
            <Search className="h-3 w-3" />
            app.leadforge.io/dashboard
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 p-5">
          {STATS.map((s) => (
            <div
              key={s.label}
              className={`rounded-xl border p-4 backdrop-blur-sm ${
                s.accent
                  ? "border-primary/20 bg-primary/[0.04]"
                  : "border-white/[0.04] bg-white/[0.015]"
              }`}
            >
              <p className="text-[9px] font-semibold uppercase tracking-wider text-white/30">{s.label}</p>
              <p className={`mt-2 text-xl font-bold ${s.accent ? "text-gradient-brand" : "text-white"}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Trending */}
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.015] p-3">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-medium text-white/50">Lead acquisition trending up 12.4% this week</span>
          </div>
        </div>

        {/* Lead rows */}
        <div className="space-y-1.5 px-5 pb-5">
          <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/25">Top opportunities</p>
          {ROWS.map((row) => (
            <div
              key={row.company}
              className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-2.5 transition-colors hover:bg-white/[0.03]"
            >
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-white/80">{row.company}</p>
                <p className="text-[10px] text-white/30">{row.niche}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="rounded-full border border-red-500/10 bg-red-500/5 px-2.5 py-0.5 text-[9px] font-medium text-red-300/70">
                  {row.website}
                </span>
                <span className="rounded-lg bg-gradient-brand px-2.5 py-0.5 text-[10px] font-bold text-brand-ink">
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
