"use client";

import { useEffect, useState } from "react";

const SEARCH_FIELDS = [
  { label: "INDUSTRY", value: "Restaurants", delay: 0.2 },
  { label: "LOCATION", value: "Miami", delay: 0.4 },
  { label: "WEBSITE", value: "No website", delay: 0.6 },
  { label: "RATING", value: "4+ stars", delay: 0.8 },
];

const MARKET_NODES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: 10 + Math.random() * 80,
  y: 15 + Math.random() * 70,
  delay: 1 + Math.random() * 2,
  activates: i < 5,
}));

export function DiscoverySection() {
  const [inView, setInView] = useState(false);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const timer = setInterval(() => {
      setActiveCount((c) => {
        if (c >= 5) { clearInterval(timer); return c; }
        return c + 1;
      });
    }, 400);
    return () => clearInterval(timer);
  }, [inView]);

  return (
    <section className="relative border-t border-white/[0.04] py-24">
      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-20">
        {/* LEFT: Editorial text */}
        <div data-reveal className="flex flex-col justify-center">
          <span className="label-caps text-primary">01 / Discovery Engine</span>
          <h2 className="mt-5 text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-[-0.03em] text-white">
            SEARCH<br />THE MARKET.
          </h2>
          <p className="mt-6 max-w-sm text-[13px] leading-relaxed text-white/30">
            Search your market by location, niche and opportunity. LeadForge
            scans thousands of businesses and surfaces those with untapped digital
            potential.
          </p>
          {/* Micro annotations */}
          <div className="mt-8 flex items-center gap-4 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/15">
            <span>[AI_SCAN_01]</span>
            <span className="h-px w-3 bg-white/8" />
            <span>[MARKET_DATA]</span>
            <span className="h-px w-3 bg-white/8" />
            <span>[REAL-TIME]</span>
          </div>
        </div>

        {/* RIGHT: Search UI + artwork */}
        <div
          ref={(el) => {
            if (el) {
              const obs = new IntersectionObserver(
                ([e]) => { if (e.isIntersecting) setInView(true); },
                { threshold: 0.2 }
              );
              obs.observe(el);
              return () => obs.disconnect();
            }
          }}
          className="relative"
        >
          {/* Abstract market map artwork behind search UI */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {MARKET_NODES.map((node) => {
              const isActive = node.id < activeCount;
              return (
                <div
                  key={node.id}
                  className="absolute rounded-full transition-all duration-700"
                  style={{
                    left: `${node.x}%`,
                    top: `${node.y}%`,
                    width: isActive ? "6px" : "3px",
                    height: isActive ? "6px" : "3px",
                    background: isActive
                      ? "hsl(82 100% 61%)"
                      : "hsl(0 0% 100% / 0.08)",
                    boxShadow: isActive
                      ? "0 0 12px hsl(82 100% 61% / 0.4)"
                      : "none",
                    opacity: inView ? 1 : 0,
                    transition: `all 0.6s ease ${node.delay}s`,
                  }}
                />
              );
            })}
            {/* Connecting lines between active nodes */}
            <svg className="absolute inset-0 h-full w-full" style={{ opacity: activeCount > 1 ? 0.15 : 0, transition: "opacity 1s ease" }}>
              <line x1="15%" y1="25%" x2="35%" y2="40%" stroke="hsl(82 100% 61%)" strokeWidth="0.5" />
              <line x1="35%" y1="40%" x2="55%" y2="30%" stroke="hsl(82 100% 61%)" strokeWidth="0.5" />
              <line x1="55%" y1="30%" x2="70%" y2="55%" stroke="hsl(82 100% 61%)" strokeWidth="0.5" />
              <line x1="20%" y1="60%" x2="45%" y2="65%" stroke="hsl(82 100% 61%)" strokeWidth="0.5" />
            </svg>
          </div>

          {/* Search instrument panel */}
          <div className="glass-card-static relative z-10 overflow-hidden rounded-xl border border-white/[0.05] bg-[#070707]/90 p-5 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30">
                Market Search
              </span>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" style={{ boxShadow: "0 0 6px hsl(82 100% 61% / 0.5)" }} />
                <span className="text-[7px] uppercase tracking-[0.12em] text-primary/60">ACTIVE</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {SEARCH_FIELDS.map((field) => (
                <div
                  key={field.label}
                  className="rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2.5"
                  style={{
                    opacity: inView ? 1 : 0,
                    transform: inView ? "translateY(0)" : "translateY(8px)",
                    transition: `all 0.5s ease ${field.delay}s`,
                  }}
                >
                  <p className="text-[7px] font-semibold uppercase tracking-[0.15em] text-white/20">
                    {field.label}
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-white/60">
                    {field.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Results counter */}
            <div
              className="mt-4 flex items-center justify-between rounded-lg border border-primary/10 bg-primary/[0.03] px-3 py-2"
              style={{
                opacity: inView ? 1 : 0,
                transition: "opacity 0.5s ease 1.2s",
              }}
            >
              <div>
                <p className="text-[7px] font-semibold uppercase tracking-[0.15em] text-white/20">RESULTS</p>
                <p className="text-xl font-bold tabular-nums text-gradient-brand">2,481</p>
              </div>
              <div>
                <p className="text-[7px] font-semibold uppercase tracking-[0.15em] text-white/20">OPPORTUNITY</p>
                <p className="text-sm font-bold text-primary/80">HIGH</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
