"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

const STAGES = [
  { label: "BUSINESS DETECTED", detail: "Bella Vista Ristorante · Miami" },
  { label: "WEBSITE ANALYZED", detail: "Status: No dedicated website" },
  { label: "REVIEWS ANALYZED", detail: "4.7 stars · 238 reviews" },
  { label: "SOCIAL PRESENCE ANALYZED", detail: "Active on Instagram · 2.1K followers" },
  { label: "OPPORTUNITY IDENTIFIED", detail: "Score: 94/100 · HIGH POTENTIAL" },
];

export function AnalysisSection() {
  const [inView, setInView] = useState(false);
  const [activeStage, setActiveStage] = useState(-1);
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
    const timers = STAGES.map((_, i) =>
      setTimeout(() => setActiveStage(i), 800 + i * 600)
    );
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  return (
    <section ref={sectionRef} className="relative border-t border-white/[0.04] py-24">
      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-20">
        {/* LEFT: Editorial text */}
        <div data-reveal className="flex flex-col justify-center">
          <span className="label-caps text-primary">03 / AI Analysis</span>
          <h2 className="mt-5 text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-[-0.03em] text-white text-glow-lime">
            KNOW<br />WHY THEY<br />NEED YOU.
          </h2>
          <p className="mt-6 max-w-sm text-[13px] leading-relaxed text-white/30">
            LeadForge&apos;s AI engine deconstructs each business — analyzing their
            website, reviews, and social presence to identify exactly why
            they need your services.
          </p>
          <div className="mt-8 flex items-center gap-4 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/15">
            <span>[AI_ANALYSIS]</span>
            <span className="h-px w-3 bg-white/8" />
            <span>[NEURAL_SCAN]</span>
          </div>
        </div>

        {/* RIGHT: Analysis interface */}
        <div data-reveal>
          <div className="glass-card-static relative overflow-hidden rounded-xl border border-white/[0.05] bg-[#070707]/90 p-5 backdrop-blur-xl">
            {/* Scanning line */}
            <div
              className="pointer-events-none absolute left-0 right-0 h-px"
              style={{
                background: "linear-gradient(90deg, transparent, hsl(82 100% 61% / 0.4), transparent)",
                top: inView ? "100%" : "0%",
                opacity: inView && activeStage < STAGES.length - 1 ? 0.6 : 0,
                transition: "top 3s linear, opacity 0.5s ease",
              }}
            />

            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30">
                AI Analysis Pipeline
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: activeStage >= STAGES.length - 1 ? "hsl(82 100% 61%)" : "hsl(38 84% 56%)",
                    animation: "status-pulse 2s ease-in-out infinite",
                  }}
                />
                <span className="text-[7px] uppercase tracking-[0.12em] text-white/20">
                  {activeStage >= STAGES.length - 1 ? "ANALYSIS COMPLETE" : "PROCESSING"}
                </span>
              </div>
            </div>

            {/* Stages */}
            <div className="space-y-2">
              {STAGES.map((stage, i) => {
                const isActive = i <= activeStage;
                const isCurrent = i === activeStage;
                return (
                  <div
                    key={stage.label}
                    className="flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-all duration-500"
                    style={{
                      borderColor: isActive
                        ? "hsl(82 100% 61% / 0.15)"
                        : "hsl(0 0% 100% / 0.03)",
                      background: isActive
                        ? "hsl(82 100% 61% / 0.03)"
                        : "transparent",
                    }}
                  >
                    {/* Indicator */}
                    <div
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-all duration-500"
                      style={{
                        background: isActive
                          ? "hsl(82 100% 61% / 0.15)"
                          : "hsl(0 0% 100% / 0.04)",
                        boxShadow: isCurrent
                          ? "0 0 8px hsl(82 100% 61% / 0.3)"
                          : "none",
                      }}
                    >
                      {isActive ? (
                        <Check className="h-2.5 w-2.5" style={{ color: "hsl(82 100% 61%)" }} />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-white/10" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-[10px] font-semibold transition-colors duration-500"
                        style={{ color: isActive ? "hsl(0 0% 85%)" : "hsl(0 0% 40%)" }}
                      >
                        {stage.label}
                      </p>
                      <p
                        className="mt-0.5 text-[9px] transition-colors duration-500"
                        style={{ color: isActive ? "hsl(0 0% 50%)" : "hsl(0 0% 20%)" }}
                      >
                        {stage.detail}
                      </p>
                    </div>
                    {isCurrent && (
                      <span className="ml-auto text-[7px] font-medium text-primary/60">ACTIVE</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress */}
            <div className="mt-4">
              <div className="h-0.5 overflow-hidden rounded-full bg-white/[0.03]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${((activeStage + 1) / STAGES.length) * 100}%`,
                    background: "linear-gradient(90deg, hsl(82 100% 61% / 0.5), hsl(82 100% 61%))",
                    transition: "width 0.6s ease",
                    boxShadow: "0 0 8px hsl(82 100% 61% / 0.3)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
