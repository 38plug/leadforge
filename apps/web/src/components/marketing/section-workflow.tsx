"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Brain, BarChart3, Sparkles, Send, RefreshCw, Trophy } from "lucide-react";

const WORKFLOW_STEPS = [
  { icon: Search, label: "DISCOVER", detail: "Scan market" },
  { icon: Brain, label: "ANALYZE", detail: "AI analysis" },
  { icon: BarChart3, label: "SCORE", detail: "Opportunity" },
  { icon: Sparkles, label: "PERSONALIZE", detail: "AI outreach" },
  { icon: Send, label: "CONTACT", detail: "Multi-channel" },
  { icon: RefreshCw, label: "FOLLOW UP", detail: "Automated" },
  { icon: Trophy, label: "CONVERT", detail: "Win client" },
];

export function WorkflowSection() {
  const [inView, setInView] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
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
    let step = 0;
    const timer = setInterval(() => {
      setActiveStep(step);
      step++;
      if (step >= WORKFLOW_STEPS.length) {
        setTimeout(() => { step = 0; setActiveStep(-1); }, 1500);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [inView]);

  return (
    <section ref={sectionRef} className="relative border-t border-white/[0.04] py-24">
      <div data-reveal className="mb-16 text-center">
        <span className="label-caps text-primary">LeadForge Engine</span>
        <h2 className="mt-5 text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-[-0.02em] text-white text-glow-lime">
          The autonomous client acquisition machine
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[13px] text-white/30">
          From market scan to signed client — fully autonomous, AI-powered,
          human-supervised.
        </p>
      </div>

      {/* Workflow steps — connected flow */}
      <div data-reveal className="relative mx-auto max-w-4xl">
        {/* Connecting line */}
        <div className="absolute left-0 right-0 top-6 hidden h-px lg:block" style={{ background: "hsl(0 0% 100% / 0.04)" }} />

        {/* Signal traveling along the line */}
        {inView && (
          <div
            className="pointer-events-none absolute top-5 hidden h-1 w-16 rounded-full lg:block"
            style={{
              background: "linear-gradient(90deg, transparent, hsl(82 100% 61% / 0.6), transparent)",
              boxShadow: "0 0 12px hsl(82 100% 61% / 0.3)",
              animation: "signal-slide 4s linear infinite",
            }}
          />
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
          {WORKFLOW_STEPS.map((step, i) => {
            const isActive = i <= activeStep;
            const isCurrent = i === activeStep;
            return (
              <div
                key={step.label}
                className="flex flex-col items-center text-center"
                style={{
                  opacity: isActive ? 1 : 0.25,
                  transform: isActive ? "translateY(0)" : "translateY(6px)",
                  transition: "all 0.4s ease",
                }}
              >
                {/* Node */}
                <div
                  className="relative flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-400"
                  style={{
                    background: isActive
                      ? "hsl(82 100% 61% / 0.08)"
                      : "hsl(0 0% 100% / 0.02)",
                    border: `1px solid ${isActive ? "hsl(82 100% 61% / 0.2)" : "hsl(0 0% 100% / 0.04)"}`,
                    boxShadow: isCurrent
                      ? "0 0 20px hsl(82 100% 61% / 0.2)"
                      : "none",
                  }}
                >
                  <step.icon
                    className="h-5 w-5 transition-colors duration-400"
                    style={{ color: isActive ? "hsl(82 100% 61%)" : "hsl(0 0% 100% / 0.15)" }}
                  />
                  {isCurrent && (
                    <span
                      className="absolute -right-1 -top-1 h-2 w-2 rounded-full"
                      style={{
                        background: "hsl(82 100% 61%)",
                        boxShadow: "0 0 8px hsl(82 100% 61% / 0.5)",
                        animation: "status-pulse 1.5s ease-in-out infinite",
                      }}
                    />
                  )}
                </div>
                {/* Label */}
                <p
                  className="mt-2.5 text-[8px] font-bold uppercase tracking-[0.12em] transition-colors duration-400"
                  style={{ color: isActive ? "hsl(0 0% 70%)" : "hsl(0 0% 30%)" }}
                >
                  {step.label}
                </p>
                <p className="mt-0.5 text-[7px] text-white/15">{step.detail}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* System status */}
      <div className="mt-16 flex items-center justify-center gap-6 text-[8px] font-semibold uppercase tracking-[0.15em] text-white/15">
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-primary" style={{ animation: "status-pulse 2s ease-in-out infinite" }} />
          SYSTEM ACTIVE
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-primary" style={{ animation: "status-pulse 2s ease-in-out infinite 0.5s" }} />
          AI ENGINE RUNNING
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-primary" style={{ animation: "status-pulse 2s ease-in-out infinite 1s" }} />
          MARKET SCAN ACTIVE
        </span>
      </div>
    </section>
  );
}
