"use client";

import { useEffect, useRef, useState } from "react";

const SCORE_BREAKDOWN = [
  { label: "WEBSITE", score: "18 / 20", pct: 90 },
  { label: "ONLINE PRESENCE", score: "19 / 20", pct: 95 },
  { label: "REVIEWS", score: "17 / 20", pct: 85 },
  { label: "SOCIAL", score: "20 / 20", pct: 100 },
  { label: "CLIENT FIT", score: "20 / 20", pct: 100 },
];

export function OpportunitySection() {
  const [inView, setInView] = useState(false);
  const [score, setScore] = useState(0);
  const [analyzing, setAnalyzing] = useState(true);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold: 0.15 }
    );
    obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    const timer = setTimeout(() => setAnalyzing(false), 1500);
    const countTimer = setTimeout(() => {
      const duration = 2000;
      const start = performance.now();
      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setScore(Math.round(eased * 94));
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, 1000);
    return () => { clearTimeout(timer); clearTimeout(countTimer); };
  }, [inView]);

  const circumference = 2 * Math.PI * 40;
  const scoreOffset = circumference - (score / 100) * circumference;

  return (
    <section ref={sectionRef} className="relative border-t border-white/[0.04] py-24">
      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-20">
        {/* LEFT: Score visualization */}
        <div data-reveal className="flex items-center justify-center">
          <div className="relative flex flex-col items-center">
            {/* Circular score */}
            <div className="relative h-56 w-56">
              <svg className="h-full w-full" viewBox="0 0 100 100">
                {/* Background ring */}
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke="hsl(0 0% 100% / 0.04)"
                  strokeWidth="3"
                />
                {/* Score ring */}
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke="hsl(82 100% 61%)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="score-ring"
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset: inView ? scoreOffset : circumference,
                    transition: "stroke-dashoffset 2s cubic-bezier(0.22, 1, 0.36, 1)",
                    transform: "rotate(-90deg)",
                    transformOrigin: "center",
                    filter: "drop-shadow(0 0 6px hsl(82 100% 61% / 0.3))",
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-5xl font-bold tabular-nums text-white" style={{ textShadow: "0 0 30px hsl(82 100% 61% / 0.2)" }}>
                  {score}
                </p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">
                  {analyzing ? "ANALYZING..." : "HIGH POTENTIAL"}
                </p>
              </div>
            </div>
            {/* Status indicator */}
            <div className="mt-6 flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: analyzing ? "hsl(38 84% 56%)" : "hsl(82 100% 61%)",
                  boxShadow: `0 0 6px ${analyzing ? "hsl(38 84% 56% / 0.5)" : "hsl(82 100% 61% / 0.5)"}`,
                  animation: "status-pulse 2s ease-in-out infinite",
                }}
              />
              <span className="text-[8px] font-semibold uppercase tracking-[0.15em] text-white/20">
                {analyzing ? "SCORING LEAD" : "SCORE FINALIZED"}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT: Editorial text + breakdown */}
        <div data-reveal className="flex flex-col justify-center">
          <span className="label-caps text-primary">02 / Intelligence Engine</span>
          <h2 className="mt-5 text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-[-0.03em] text-white text-glow-lime">
            FIND<br />THE<br />OPPORTUNITY.
          </h2>
          <p className="mt-6 max-w-sm text-[13px] leading-relaxed text-white/30">
            Every lead is scored across five dimensions. The transparency
            tells you exactly why a business is worth approaching.
          </p>

          {/* Score breakdown */}
          <div className="mt-8 space-y-3">
            {SCORE_BREAKDOWN.map((item, i) => (
              <div
                key={item.label}
                className="group"
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? "translateX(0)" : "translateX(-10px)",
                  transition: `all 0.5s ease ${1.5 + i * 0.15}s`,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[8px] font-semibold uppercase tracking-[0.15em] text-white/25">
                    {item.label}
                  </span>
                  <span className="text-[10px] font-bold tabular-nums text-white/40">
                    {item.score}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/[0.04]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: inView ? `${item.pct}%` : "0%",
                      background: "linear-gradient(90deg, hsl(82 100% 61% / 0.6), hsl(82 100% 61%))",
                      transition: `width 1.5s cubic-bezier(0.22, 1, 0.36, 1) ${1.8 + i * 0.15}s`,
                      boxShadow: "0 0 8px hsl(82 100% 61% / 0.3)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Annotations */}
          <div className="mt-8 flex items-center gap-4 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/15">
            <span>[OPPORTUNITY_ENGINE]</span>
            <span className="h-px w-3 bg-white/8" />
            <span>[94/100]</span>
          </div>
        </div>
      </div>
    </section>
  );
}
