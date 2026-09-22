"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Search,
  Sparkles,
  Target,
  KanbanSquare,
  Globe,
  Shield,
} from "lucide-react";
import { LandingNav } from "@/components/marketing/landing-nav";
import { RibbonArtwork } from "@/components/marketing/ribbon-artwork";
import { ProductPanel } from "@/components/marketing/product-panel";

const FEATURES = [
  {
    icon: Search,
    title: "Discover",
    body: "Filter by country, city, and niche to surface local businesses that match your ideal client profile.",
  },
  {
    icon: Globe,
    title: "Detect",
    body: "Every lead is checked for a live, working website — outdated sites are flagged automatically.",
  },
  {
    icon: Target,
    title: "Score",
    body: "A transparent 0–100 score backed by rating, reviews, and social presence.",
  },
  {
    icon: Sparkles,
    title: "Outreach",
    body: "Turn a lead into a personalized email, call script, or DM in one click.",
  },
  {
    icon: KanbanSquare,
    title: "Pipeline",
    body: "Move leads from New to Won across a 9-stage Kanban board.",
  },
  {
    icon: Shield,
    title: "Comply",
    body: "Suppression lists, unsubscribe handling, and sending limits built in.",
  },
];

const STATS = [
  { value: "2,481", label: "Businesses analyzed / workspace / month" },
  { value: "94", label: "Avg. opportunity score" },
  { value: "3.2×", label: "More replies vs. generic outreach" },
];

export default function LandingPage() {
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
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="page-frame relative bg-[#020202]">
      {/* Grid texture */}
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-30" />

      {/* Abstract ribbon artwork */}
      <RibbonArtwork />

      {/* Content */}
      <div className="relative z-10 flex min-h-[calc(100vh-40px)] flex-col px-6 sm:px-10 md:px-14 lg:px-20">
        {/* ---- Micro nav ---- */}
        <div className="py-6 sm:py-8">
          <LandingNav />
        </div>

        {/* ============================================================
            HERO — Asymmetric editorial composition
            ============================================================ */}
        <section className="relative flex flex-1 flex-col gap-10 lg:flex-row lg:items-start lg:gap-8">
          {/* LEFT: Headline */}
          <div className="flex flex-1 flex-col justify-center pt-8 lg:pt-0">
            {/* Badge */}
            <div className="hero-badge mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.04] px-3.5 py-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-primary">
                AI-Powered Client Acquisition
              </span>
            </div>

            {/* Headline — oversized, staggered */}
            <h1 className="text-[clamp(3rem,8vw,6.5rem)] font-bold leading-[0.92] tracking-[-0.04em] text-white">
              <span className="hero-line block">FIND YOUR</span>
              <span className="hero-line block">NEXT</span>
              <span className="hero-line block text-gradient-brand">CLIENT.</span>
            </h1>

            {/* Supporting text */}
            <div className="hero-meta mt-8 max-w-md">
              <p className="text-[14px] leading-relaxed text-white/35">
                Discover businesses with untapped digital potential, understand
                their opportunity, and turn them into qualified clients.
              </p>
            </div>

            {/* CTAs */}
            <div className="hero-meta mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/register"
                className="sheen group inline-flex items-center gap-2.5 rounded-lg bg-gradient-brand px-6 py-3 text-[13px] font-bold text-brand-ink transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_30px_-6px_hsl(var(--glow-strong)/0.5)]"
              >
                Start finding leads
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/login"
                className="text-[12px] font-medium uppercase tracking-[0.1em] text-white/30 transition-colors hover:text-white/60"
              >
                Explore platform →
              </Link>
            </div>

            {/* Micro labels */}
            <div className="hero-meta mt-10 flex items-center gap-4 text-[9px] font-medium uppercase tracking-[0.15em] text-white/15">
              <span>AI-POWERED</span>
              <span className="h-px w-3 bg-white/10" />
              <span>REAL-TIME DATA</span>
              <span className="h-px w-3 bg-white/10" />
              <span>BUILT FOR AGENCIES</span>
            </div>
          </div>

          {/* RIGHT: Floating product panel */}
          <div className="flex items-center justify-center lg:justify-end lg:pt-16">
            <ProductPanel />
          </div>
        </section>

        {/* ============================================================
            STATS — Minimal horizontal strip
            ============================================================ */}
        <section data-reveal className="mt-20 border-t border-white/[0.04] py-12">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.03em] text-gradient-brand">{s.value}</p>
                <p className="mt-1 text-[11px] text-white/25">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
            FEATURES — Bento grid
            ============================================================ */}
        <section id="product" className="mt-16 border-t border-white/[0.04] py-16">
          <div data-reveal className="mb-12">
            <span className="label-caps text-primary">How it works</span>
            <h2 className="mt-4 text-[clamp(1.8rem,3.5vw,2.75rem)] font-bold tracking-[-0.02em] text-white">
              Every step from discovery to close
            </h2>
          </div>

          <div className="bento-grid">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                data-reveal
                className={`glass-card group p-6 ${
                  i < 2 ? "bento-item-wide" : "bento-item"
                }`}
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.03] transition-all duration-300 group-hover:bg-primary/[0.06]">
                  <f.icon className="h-4 w-4 text-white/40 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="mt-4 text-[14px] font-bold text-white/85">{f.title}</h3>
                <p className="mt-2 text-[12.5px] leading-relaxed text-white/30">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
            PRICING
            ============================================================ */}
        <section id="pricing" className="mt-8 border-t border-white/[0.04] py-16">
          <div data-reveal className="mb-12">
            <span className="label-caps text-primary">Pricing</span>
            <h2 className="mt-4 text-[clamp(1.8rem,3.5vw,2.75rem)] font-bold tracking-[-0.02em] text-white">
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
                  plan.highlight ? "border-primary/15" : ""
                }`}
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                {plan.highlight && (
                  <span className="absolute -top-2.5 left-4 rounded-full bg-gradient-brand px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-ink">
                    Popular
                  </span>
                )}
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">{plan.name}</p>
                <p className="mt-3 text-2xl font-bold text-white">
                  {plan.price}
                  <span className="text-[10px] font-normal text-white/20">/mo</span>
                </p>
                <ul className="mt-4 flex flex-col gap-2">
                  {plan.features.map((f) => (
                    <li key={f} className="text-[11px] text-white/35">· {f}</li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`mt-auto block rounded-lg px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.08em] transition-all duration-300 ${
                    plan.highlight
                      ? "bg-gradient-brand text-brand-ink glow-btn hover:scale-[1.02]"
                      : "border border-white/[0.06] text-white/50 hover:border-white/10 hover:text-white/70"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
            CTA
            ============================================================ */}
        <section data-reveal className="mt-8 border-t border-white/[0.04] py-20">
          <div className="glass-card-static glow-ring relative overflow-hidden px-8 py-16 text-center">
            <div
              className="pointer-events-none absolute inset-0 opacity-15"
              style={{ background: "radial-gradient(circle at 50% 50%, hsl(var(--glow-strong) / 0.2), transparent 60%)" }}
            />
            <div className="relative">
              <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold tracking-[-0.02em] text-white">
                Your next client is one search away.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[13px] text-white/30">
                Open the workspace, run a search, and see scored leads in seconds.
              </p>
              <Link
                href="/register"
                className="sheen group mt-8 inline-flex items-center gap-2.5 rounded-lg bg-gradient-brand px-6 py-3 text-[13px] font-bold text-brand-ink transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_30px_-6px_hsl(var(--glow-strong)/0.5)]"
              >
                Open LeadForge
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* ============================================================
            FOOTER
            ============================================================ */}
        <footer className="border-t border-white/[0.04] py-8">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/25">
                LeadForge INC
              </span>
              <span className="text-[9px] text-white/10">© {new Date().getFullYear()}</span>
            </div>
            <div className="flex gap-5 text-[10px] text-white/20">
              <Link href="/login" className="transition-colors hover:text-white/40">Dashboard</Link>
              <a href="#product" className="transition-colors hover:text-white/40">Product</a>
              <a href="#pricing" className="transition-colors hover:text-white/40">Pricing</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
