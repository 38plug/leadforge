"use client";

import { useEffect, useState } from "react";
import { Search, TrendingUp, Globe, Star, Sparkles } from "lucide-react";

const STAGES = [
  { label: "AI ENGINE ACTIVE", delay: 800 },
  { label: "MARKET SCAN", delay: 1600 },
  { label: "ANALYSIS READY", delay: 2400 },
];

const LEADS = [
  { name: "Bella Vista Ristorante", niche: "Restaurant", city: "Miami", score: 94, website: false },
  { name: "Zahnarztpraxis Mitte", niche: "Dentist", city: "Berlin", score: 88, website: false },
  { name: "The Gentleman's Cut", niche: "Barber", city: "London", score: 81, website: true },
];

export function ProductPanel() {
  const [activeStage, setActiveStage] = useState(-1);
  const [scoreVisible, setScoreVisible] = useState(false);

  useEffect(() => {
    const timers = STAGES.map((s, i) =>
      setTimeout(() => setActiveStage(i), s.delay)
    );
    const scoreTimer = setTimeout(() => setScoreVisible(true), 1200);
    return () => { timers.forEach(clearTimeout); clearTimeout(scoreTimer); };
  }, []);

  return (
    <div className="cinematic-panel panel-float relative w-full max-w-[360px]">
      {/* Glow behind panel */}
      <div
        className="pointer-events-none absolute -inset-16 -z-10 rounded-3xl blur-[80px]"
        style={{
          background: "radial-gradient(circle, hsl(var(--glow-strong) / 0.1), transparent 60%)",
          opacity: 0.35,
        }}
      />

      {/* Panel */}
      <div className="glass-card-static overflow-hidden rounded-xl border border-white/[0.05] bg-[#070707]/95 shadow-[0_0_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-3.5 py-2">
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-white/8" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/8" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/8" />
          </div>
          <span className="ml-1 text-[9px] font-bold uppercase tracking-[0.15em] text-white/30">
            LeadForge
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <span
              className="h-1 w-1 rounded-full"
              style={{
                background: activeStage >= 0 ? "hsl(82 100% 61%)" : "hsl(0 0% 30%)",
                boxShadow: activeStage >= 0 ? "0 0 6px hsl(82 100% 61% / 0.5)" : "none",
                transition: "all 0.6s ease",
              }}
            />
            <span className="text-[7px] font-medium uppercase tracking-[0.15em] text-white/20">
              {activeStage >= 0 ? STAGES[Math.min(activeStage, STAGES.length - 1)].label : "INITIALIZING"}
            </span>
          </div>
        </div>

        {/* Search bar */}
        <div className="border-b border-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
            <Search className="h-3 w-3 text-white/20" />
            <span className="text-[10px] text-white/25">What&apos;s your next client?</span>
          </div>
        </div>

        {/* Quick filters */}
        <div className="flex gap-2 border-b border-white/[0.03] px-4 py-2.5">
          {[
            { icon: Globe, label: "Miami" },
            { icon: Search, label: "Restaurants" },
            { icon: Star, label: "No website" },
          ].map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-1 rounded border border-white/[0.04] bg-white/[0.015] px-2 py-1"
            >
              <f.icon className="h-2.5 w-2.5 text-white/20" />
              <span className="text-[8px] font-medium text-white/30">{f.label}</span>
            </div>
          ))}
        </div>

        {/* Opportunity score */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[7px] font-semibold uppercase tracking-[0.15em] text-white/20">
                Opportunity Score
              </p>
              <p
                className="mt-1 text-3xl font-bold tabular-nums transition-all duration-1000"
                style={{
                  color: scoreVisible ? "hsl(82 100% 61%)" : "hsl(0 0% 15%)",
                  textShadow: scoreVisible ? "0 0 20px hsl(82 100% 61% / 0.3)" : "none",
                }}
              >
                {scoreVisible ? "94" : "—"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded border border-primary/10 bg-primary/[0.04] px-2 py-1">
              <TrendingUp className="h-2.5 w-2.5 text-primary" />
              <span className="text-[8px] font-medium text-primary/70">HIGH POTENTIAL</span>
            </div>
          </div>
        </div>

        {/* Lead list */}
        <div className="space-y-1 px-4 pb-3">
          {LEADS.map((lead, i) => (
            <div
              key={lead.name}
              className="flex items-center justify-between rounded-lg border border-white/[0.03] bg-white/[0.01] px-3 py-2 transition-all duration-300 hover:bg-white/[0.03] hover:border-white/[0.06]"
              style={{ animationDelay: `${1.5 + i * 0.2}s` }}
            >
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold text-white/70">{lead.name}</p>
                <p className="text-[8px] text-white/20">{lead.niche} · {lead.city}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="rounded border border-white/[0.04] px-1.5 py-0.5 text-[7px] font-medium text-white/25">
                  {lead.website ? "HAS SITE" : "NO SITE"}
                </span>
                <span
                  className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold tabular-nums"
                  style={{ color: "hsl(82 100% 61%)" }}
                >
                  {lead.score}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="border-t border-white/[0.03] px-4 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-medium uppercase tracking-[0.12em] text-white/20">
              Scan Market →
            </span>
            <div className="flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5 text-primary/40" />
              <span className="text-[7px] text-white/15">AI-powered</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
