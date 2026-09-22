"use client";

import { useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { LandingNav } from "@/components/marketing/landing-nav";
import { RibbonArtwork } from "@/components/marketing/ribbon-artwork";
import { ProductPanel } from "@/components/marketing/product-panel";
import { FloatingAnnotation } from "@/components/marketing/annotation";
import { DiscoverySection } from "@/components/marketing/section-discovery";
import { OpportunitySection } from "@/components/marketing/section-opportunity";
import { AnalysisSection } from "@/components/marketing/section-analysis";
import { OutreachSection } from "@/components/marketing/section-outreach";
import { CRMSection } from "@/components/marketing/section-crm";
import { WorkflowSection } from "@/components/marketing/section-workflow";

export default function LandingPage() {
  /* Scroll reveal observer */
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px -30px 0px" }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  /* Parallax on mousemove (desktop only) */
  const rafRef = useRef<number>(0);
  const handleMouseMove = useCallback((e: MouseEvent) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      document.documentElement.style.setProperty("--px", `${x}`);
      document.documentElement.style.setProperty("--py", `${y}`);
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!mq.matches) return;
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  return (
    <div className="page-frame grain-overlay vignette relative bg-[#0a0a0a]">
      {/* Dot grid texture */}
      <div className="pointer-events-none absolute inset-0 z-0 dot-grid opacity-30" />

      {/* Ambient glow washes — lime left, amber right */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute -left-[15%] top-[10%] h-[60vh] w-[40vw] rounded-full"
          style={{
            background: "radial-gradient(ellipse, hsl(82 100% 61% / 0.06), transparent 60%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute -right-[10%] top-[30%] h-[50vh] w-[35vw] rounded-full"
          style={{
            background: "radial-gradient(ellipse, hsl(28 85% 55% / 0.04), transparent 60%)",
            filter: "blur(50px)",
          }}
        />
        <div
          className="absolute bottom-[10%] left-[25%] h-[40vh] w-[30vw] rounded-full"
          style={{
            background: "radial-gradient(ellipse, hsl(82 100% 61% / 0.03), transparent 55%)",
            filter: "blur(50px)",
          }}
        />
      </div>

      {/* Abstract ribbon artwork — depth layer 1 */}
      <div className="parallax-bg" style={{ transform: "translate(calc(var(--px, 0) * -3px), calc(var(--py, 0) * -3px))" }}>
        <RibbonArtwork />
      </div>

      {/* Content — depth layer 3 */}
      <div className="parallax-fg relative z-10 flex min-h-[calc(100vh-40px)] flex-col px-6 sm:px-10 md:px-14 lg:px-20">
        {/* ---- Micro nav ---- */}
        <div className="cinematic-nav py-6 sm:py-8">
          <LandingNav />
        </div>

        {/* ============================================================
            HERO — Asymmetric editorial composition
            ============================================================ */}
        <section className="relative flex flex-1 flex-col gap-10 lg:flex-row lg:items-start lg:gap-8">
          {/* LEFT: Headline */}
          <div className="flex flex-1 flex-col justify-center pt-8 lg:pt-0">
            {/* Badge */}
            <div className="cinematic-label mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-3.5 py-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-primary">
                AI-Powered Client Acquisition
              </span>
            </div>

            {/* Headline — oversized, staggered, with glow */}
            <h1 className="text-[clamp(3rem,8vw,6.5rem)] font-bold leading-[0.92] tracking-[-0.04em] text-white text-glow-lime">
              <span className="hero-line block">FIND YOUR</span>
              <span className="hero-line block">NEXT</span>
              <span className="hero-line block text-gradient-brand">CLIENT.</span>
            </h1>

            {/* Supporting text */}
            <div className="hero-meta mt-8 max-w-md">
              <p className="text-[14px] leading-relaxed text-white/50">
                Discover businesses with untapped digital potential, understand
                their opportunity, and turn them into qualified clients.
              </p>
            </div>

            {/* CTAs */}
            <div className="hero-meta mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/register"
                className="sheen group inline-flex items-center gap-2.5 rounded-lg bg-gradient-brand px-6 py-3 text-[13px] font-bold text-brand-ink transition-all duration-300 hover:scale-[1.03] glow-btn"
              >
                Start finding leads
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/login"
                className="group text-[12px] font-medium uppercase tracking-[0.1em] text-white/40 transition-colors hover:text-white/70"
              >
                Explore platform
                <span className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </div>

            {/* Micro metadata labels */}
            <div className="hero-meta mt-10 flex items-center gap-4 text-[9px] font-medium uppercase tracking-[0.15em] text-white/25">
              <span>AI-POWERED</span>
              <span className="h-px w-3 bg-primary/30" />
              <span>REAL-TIME DATA</span>
              <span className="h-px w-3 bg-primary/30" />
              <span>BUILT FOR AGENCIES</span>
            </div>
          </div>

          {/* RIGHT: Floating product panel */}
          <div className="flex items-center justify-center lg:justify-end lg:pt-16">
            <ProductPanel />
          </div>
        </section>

        {/* ---- Floating technical annotations (hero) ---- */}
        <FloatingAnnotation label="AI_SCAN_01" value="ACTIVE" top="15%" right="-2%" delay={1.5} />
        <FloatingAnnotation label="LEAD_DETECTED" value="94" top="35%" left="-3%" delay={1.8} />
        <FloatingAnnotation label="OPPORTUNITY_ENGINE" bottom="25%" right="5%" delay={2} />
        <FloatingAnnotation label="MARKET_DATA" value="2,481" bottom="40%" left="2%" delay={2.2} dotColor="hsl(28 85% 55% / 0.5)" />

        {/* ============================================================
            STATS — Minimal horizontal strip
            ============================================================ */}
        <section data-reveal className="mt-20 border-t border-white/[0.08] py-12">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              { value: "2,481", label: "Businesses analyzed / workspace / month" },
              { value: "94", label: "Avg. opportunity score" },
              { value: "3.2×", label: "More replies vs. generic outreach" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.03em] text-gradient-brand text-glow-lime">{s.value}</p>
                <p className="mt-1 text-[11px] text-white/40">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
            SECTION 2 — Market Discovery
            ============================================================ */}
        <DiscoverySection />

        {/* ============================================================
            SECTION 3 — Opportunity
            ============================================================ */}
        <OpportunitySection />

        {/* ============================================================
            SECTION 4 — AI Analysis
            ============================================================ */}
        <AnalysisSection />

        {/* ============================================================
            SECTION 5 — AI Outreach
            ============================================================ */}
        <OutreachSection />

        {/* ============================================================
            SECTION 6 — CRM Pipeline
            ============================================================ */}
        <CRMSection />

        {/* ============================================================
            AUTONOMOUS WORKFLOW
            ============================================================ */}
        <WorkflowSection />

        {/* ============================================================
            PRICING — Editorial style
            ============================================================ */}
        <section id="pricing" className="mt-8 border-t border-white/[0.08] py-20">
          <div data-reveal className="mb-14">
            <span className="label-caps">Pricing</span>
            <h2 className="mt-5 text-[clamp(2rem,4vw,3.5rem)] font-bold tracking-[-0.02em] text-white text-glow-lime">
              One new client pays for a year
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                name: "Free",
                price: "$0",
                features: ["50 lead searches/mo", "10 AI analyses/mo", "1 seat"],
                cta: "Start for free",
              },
              {
                name: "Starter",
                price: "$29",
                features: ["500 lead searches/mo", "100 AI analyses/mo", "2 seats"],
                cta: "Start free trial",
              },
              {
                name: "Pro",
                price: "$79",
                features: ["2,000 lead searches/mo", "500 AI analyses/mo", "5 seats"],
                cta: "Start free trial",
                highlight: true,
              },
              {
                name: "Agency",
                price: "$199",
                features: ["10,000 lead searches/mo", "2,500 AI analyses/mo", "15 seats"],
                cta: "Start free trial",
              },
            ].map((plan, i) => (
              <div
                key={plan.name}
                data-reveal
                className={`glass-card relative flex flex-col p-5 ${
                  plan.highlight ? "border-primary/20 glow-lime" : ""
                }`}
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                {plan.highlight && (
                  <span className="absolute -top-2.5 left-4 rounded-full bg-gradient-brand px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-ink">
                    Popular
                  </span>
                )}
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/60">{plan.name}</p>
                <p className="mt-3 text-2xl font-bold text-white">
                  {plan.price}
                  <span className="text-[10px] font-normal text-white/30">/mo</span>
                </p>
                <ul className="mt-4 flex flex-col gap-2">
                  {plan.features.map((f) => (
                    <li key={f} className="text-[11px] text-white/45">· {f}</li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`mt-auto block rounded-lg px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.08em] transition-all duration-300 ${
                    plan.highlight
                      ? "bg-gradient-brand text-brand-ink glow-btn hover:scale-[1.02]"
                      : "border border-white/[0.1] text-white/55 hover:border-primary/20 hover:text-white/75"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
            FINAL CTA — With ambient artwork
            ============================================================ */}
        <section data-reveal className="mt-8 border-t border-white/[0.08] py-24">
          <div className="relative overflow-hidden px-8 py-20">
            {/* Ambient artwork behind CTA */}
            <div className="pointer-events-none absolute inset-0">
              <div
                className="animate-ribbon-drift absolute -right-20 -top-20 h-80 w-80 rounded-full"
                style={{
                  background: "radial-gradient(circle, hsl(82 100% 61% / 0.12), transparent 65%)",
                  filter: "blur(30px)",
                }}
              />
              <div
                className="animate-ribbon-drift-alt absolute -bottom-16 -left-16 h-64 w-64 rounded-full"
                style={{
                  background: "radial-gradient(circle, hsl(28 85% 55% / 0.08), transparent 65%)",
                  filter: "blur(25px)",
                }}
              />
            </div>

            <div className="relative text-center">
              <h2 className="text-[clamp(2rem,5vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.03em] text-white text-glow-lime">
                YOUR NEXT<br />CLIENT<br />
                <span className="text-gradient-brand">IS OUT THERE.</span>
              </h2>
              <p className="mx-auto mt-6 max-w-md text-[13px] leading-relaxed text-white/45">
                Search the market. Find the opportunity. Let LeadForge do
                the intelligence.
              </p>
              <Link
                href="/register"
                className="sheen group mt-10 inline-flex items-center gap-2.5 rounded-lg bg-gradient-brand px-8 py-3.5 text-[13px] font-bold text-brand-ink transition-all duration-300 hover:scale-[1.03] glow-btn"
              >
                Start finding leads
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>

        {/* ============================================================
            FOOTER — Minimal
            ============================================================ */}
        <footer className="border-t border-white/[0.08] py-8">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/35">
                LeadForge INC
              </span>
              <span className="text-[9px] text-white/15">© {new Date().getFullYear()}</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex gap-5 text-[10px] text-white/30">
                <Link href="/login" className="transition-colors hover:text-white/50">Dashboard</Link>
                <a href="#product" className="transition-colors hover:text-white/50">Product</a>
                <a href="#pricing" className="transition-colors hover:text-white/50">Pricing</a>
              </div>
              <div className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.12em] text-primary/40">
                <span className="h-1 w-1 rounded-full bg-primary" style={{ animation: "status-pulse 2s ease-in-out infinite" }} />
                System operational
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
