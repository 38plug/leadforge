"use client";

import { useEffect, useRef, useState } from "react";

const COLUMNS = [
  { label: "NEW", count: 12, color: "hsl(0 0% 60%)" },
  { label: "RESEARCHED", count: 8, color: "hsl(210 50% 55%)" },
  { label: "CONTACTED", count: 5, color: "hsl(28 85% 55%)" },
  { label: "REPLIED", count: 3, color: "hsl(45 80% 55%)" },
  { label: "QUALIFIED", count: 2, color: "hsl(82 100% 61%)" },
  { label: "PROPOSAL", count: 1, color: "hsl(160 60% 50%)" },
  { label: "WON", count: 1, color: "hsl(82 100% 61%)" },
];

const LEADS_BY_STAGE = [
  [
    { name: "Café Lumière", score: 76, city: "Paris" },
    { name: "Autohaus Müller", score: 72, city: "Munich" },
    { name: "Studio Kino", score: 68, city: "Tokyo" },
  ],
  [
    { name: "Zahnarztpraxis Mitte", score: 88, city: "Berlin" },
    { name: "The Gentleman's Cut", score: 81, city: "London" },
  ],
  [
    { name: "Bella Vista Ristorante", score: 94, city: "Miami" },
  ],
  [
    { name: "Le Petit Bistrot", score: 85, city: "Lyon" },
  ],
  [
    { name: "Gardening Pros", score: 91, city: "Austin" },
  ],
  [
    { name: "Tech Repair Hub", score: 79, city: "Toronto" },
  ],
  [
    { name: "Sunset Dental", score: 96, city: "LA" },
  ],
];

export function CRMSection() {
  const [inView, setInView] = useState(false);
  const [activeCol, setActiveCol] = useState(-1);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold: 0.1 }
    );
    obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    const timers = COLUMNS.map((_, i) =>
      setTimeout(() => setActiveCol(i), 400 + i * 200)
    );
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  return (
    <section ref={sectionRef} className="relative border-t border-white/[0.04] py-24">
      <div data-reveal className="mb-12">
        <span className="label-caps text-primary">05 / Pipeline</span>
        <h2 className="mt-5 text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-[-0.03em] text-white">
          EVERY<br />OPPORTUNITY.<br />ONE PLACE.
        </h2>
      </div>

      {/* Pipeline columns */}
      <div data-reveal className="overflow-x-auto pb-4">
        <div className="flex gap-2" style={{ minWidth: "900px" }}>
          {COLUMNS.map((col, i) => {
            const isActive = i <= activeCol;
            const leads = LEADS_BY_STAGE[i] || [];
            return (
              <div
                key={col.label}
                className="flex-1"
                style={{
                  opacity: isActive ? 1 : 0.2,
                  transform: isActive ? "translateY(0)" : "translateY(10px)",
                  transition: `all 0.5s ease ${i * 0.1}s`,
                }}
              >
                {/* Column header */}
                <div className="mb-2 flex items-center justify-between border-b border-white/[0.04] pb-2">
                  <span className="text-[8px] font-semibold uppercase tracking-[0.15em] text-white/25">
                    {col.label}
                  </span>
                  <span
                    className="text-[10px] font-bold tabular-nums"
                    style={{ color: col.color }}
                  >
                    {col.count}
                  </span>
                </div>
                {/* Cards */}
                <div className="space-y-2">
                  {leads.map((lead, j) => (
                    <div
                      key={lead.name}
                      className="rounded-lg border border-white/[0.04] bg-white/[0.015] p-2.5 transition-all duration-300 hover:border-white/[0.08] hover:bg-white/[0.03]"
                      style={{
                        opacity: isActive ? 1 : 0,
                        transition: `opacity 0.4s ease ${0.3 + i * 0.1 + j * 0.1}s`,
                      }}
                    >
                      <p className="text-[10px] font-semibold text-white/65">{lead.name}</p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[8px] text-white/20">{lead.city}</span>
                        <span
                          className="rounded bg-primary/10 px-1 py-0.5 text-[8px] font-bold tabular-nums"
                          style={{ color: "hsl(82 100% 61%)" }}
                        >
                          {lead.score}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Annotation */}
      <div className="mt-8 flex items-center gap-4 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/15">
        <span>[PIPELINE_ACTIVE]</span>
        <span className="h-px w-3 bg-white/8" />
        <span>[32 LEADS]</span>
        <span className="h-px w-3 bg-white/8" />
        <span>[7 STAGES]</span>
      </div>
    </section>
  );
}
