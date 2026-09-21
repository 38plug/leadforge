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
  Star,
  Check,
  Zap,
} from "lucide-react";
import { LandingNav } from "@/components/marketing/landing-nav";
import { HeroMockup } from "@/components/marketing/hero-mockup";

const FEATURES = [
  {
    icon: Search,
    title: "Discover the right businesses",
    body: "Filter by country, city, and niche to surface local businesses that match your ideal client profile.",
  },
  {
    icon: Globe,
    title: "Real website detection",
    body: "Every lead is checked for a live, working website — no website and outdated sites are flagged automatically.",
  },
  {
    icon: Target,
    title: "Opportunity scoring",
    body: "A transparent 0–100 score explains exactly why a business is a good fit, backed by rating, reviews, and social presence.",
  },
  {
    icon: Sparkles,
    title: "AI-generated outreach",
    body: "Turn a lead into a personalized email, call script, or Instagram DM in one click — always reviewed before it validates.",
  },
  {
    icon: KanbanSquare,
    title: "Built-in CRM pipeline",
    body: "Move leads from New to Won across a 9-stage Kanban board with activity history and follow-up reminders.",
  },
  {
    icon: Star,
    title: "Compliant campaigns",
    body: "Suppression lists, unsubscribe handling, and sending limits are built in from day one — not bolted on later.",
  },
];

const STATS = [
  { value: "2,481", label: "Businesses analyzed / workspace / month" },
  { value: "94", label: "Avg. opportunity score of saved leads" },
  { value: "3.2×", label: "More replies vs. generic cold outreach" },
];

function ParticlesField() {
  return (
    <div className="hero-particles">
      {/* Particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={`p-${i}`} className="particle" />
      ))}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={`pl-${i}`} className="particle particle-lg" />
      ))}
      {/* Network lines */}
      <div className="hero-network">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`l-${i}`} className="line" />
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  // Scroll reveal observer
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
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#050505] text-white">
      {/* Ambient glow field */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-[-18%] h-[700px] w-[1100px] -translate-x-1/2 rounded-full opacity-50 blur-[160px]"
          style={{ background: "radial-gradient(circle, hsl(var(--glow-strong) / 0.5), transparent 60%)" }}
        />
        <div
          className="absolute right-[-15%] top-[10%] h-[500px] w-[500px] rounded-full opacity-30 blur-[140px]"
          style={{ background: "radial-gradient(circle, hsl(var(--glow-soft) / 0.4), transparent 60%)" }}
        />
        <div
          className="absolute left-[-12%] top-[50%] h-[450px] w-[450px] rounded-full opacity-25 blur-[150px]"
          style={{ background: "radial-gradient(circle, hsl(var(--glow-strong) / 0.35), transparent 60%)" }}
        />
      </div>

      {/* Grid texture */}
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />

      {/* Navigation */}
      <div className="relative px-4 pt-6 sm:px-6">
        <LandingNav />
      </div>

      {/* ================================================================
          HERO — Cinematic centerpiece
          ================================================================ */}
      <section className="relative px-4 pb-20 pt-20 sm:px-6 sm:pt-32">
        <ParticlesField />

        <div className="relative mx-auto flex max-w-6xl flex-col items-center text-center">
          {/* Badge */}
          <div
            data-reveal
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-primary"
          >
            <Zap className="h-3 w-3" />
            AI-powered client acquisition
          </div>

          {/* Headline */}
          <h1
            data-reveal
            className="mt-8 max-w-4xl text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[1.05] tracking-tight text-balance"
          >
            Find businesses that{" "}
            <span className="text-gradient-brand">need you</span>
          </h1>

          {/* Subtext */}
          <p
            data-reveal
            className="mt-6 max-w-xl text-balance text-[15px] leading-relaxed text-white/45 sm:text-base"
          >
            Discover businesses with untapped digital potential, understand their
            opportunity, and turn them into qualified clients.
          </p>

          {/* CTAs */}
          <div data-reveal className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="sheen group inline-flex items-center gap-2.5 rounded-xl bg-gradient-brand px-7 py-3.5 text-sm font-bold text-brand-ink transition-all hover:scale-[1.04] hover:shadow-[0_0_30px_-6px_hsl(var(--glow-strong)/0.6)]"
            >
              Start finding leads
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-7 py-3.5 text-sm font-semibold text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
            >
              Explore platform
            </Link>
          </div>

          {/* Trust line */}
          <div data-reveal className="mt-8 flex items-center gap-3 text-[11px] text-white/25">
            <span>AI-POWERED</span>
            <span className="h-1 w-1 rounded-full bg-white/15" />
            <span>REAL-TIME DATA</span>
            <span className="h-1 w-1 rounded-full bg-white/15" />
            <span>BUILT FOR AGENCIES</span>
          </div>
        </div>

        {/* Hero mockup */}
        <div data-reveal className="relative mx-auto mt-20 max-w-3xl">
          <HeroMockup />
        </div>
      </section>

      {/* ================================================================
          STATS STRIP
          ================================================================ */}
      <section id="how-it-works" data-reveal className="relative border-y border-white/[0.04] bg-white/[0.01] px-4 py-12 sm:px-6">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-4xl font-bold tracking-tight text-gradient-brand">{s.value}</p>
              <p className="mx-auto mt-2 max-w-[220px] text-[12px] leading-snug text-white/35">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================
          FEATURES
          ================================================================ */}
      <section id="product" className="relative px-4 py-24 sm:px-6 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div data-reveal className="mx-auto max-w-xl text-center">
            <span className="label-caps text-primary">How it works</span>
            <h2 className="mt-4 text-[clamp(1.5rem,3vw,2.25rem)] font-bold tracking-tight text-balance">
              Every step from discovery to close, in one workspace
            </h2>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                data-reveal
                className="glow-card group rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.04]"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/[0.08] transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/[0.14]">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-5 text-[15px] font-semibold text-white/90">{f.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-white/40">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          PRICING
          ================================================================ */}
      <section id="pricing" className="relative px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div data-reveal className="mx-auto max-w-xl text-center">
            <span className="label-caps text-primary">Pricing</span>
            <h2 className="mt-4 text-[clamp(1.5rem,3vw,2.25rem)] font-bold tracking-tight text-balance">
              One new client pays for a year of LeadForge
            </h2>
            <p className="mt-3 text-[13.5px] text-white/40">
              Start free. No credit card required. Upgrade only once leads are turning into real pipeline.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                name: "Free",
                price: "$0",
                desc: "Try the full workflow, no card needed",
                features: ["50 lead searches/mo", "10 AI analyses/mo", "1 seat", "CRM & lead scoring included"],
                cta: "Start for free",
              },
              {
                name: "Starter",
                price: "$29",
                desc: "For freelancers testing the waters",
                features: ["500 lead searches/mo", "100 AI analyses/mo", "2 seats", "Email outreach campaigns"],
                cta: "Start free trial",
              },
              {
                name: "Pro",
                price: "$79",
                desc: "For designers running steady outreach",
                features: ["2,000 lead searches/mo", "500 AI analyses/mo", "5 seats", "Priority AI generation"],
                cta: "Start free trial",
                highlight: true,
              },
              {
                name: "Agency",
                price: "$199",
                desc: "For teams closing multiple clients/mo",
                features: ["10,000 lead searches/mo", "2,500 AI analyses/mo", "15 seats", "Dedicated onboarding"],
                cta: "Start free trial",
              },
            ].map((plan, i) => (
              <div
                key={plan.name}
                data-reveal
                className={`relative rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 ${
                  plan.highlight
                    ? "border-primary/30 bg-primary/[0.04] glow-ring"
                    : "border-white/[0.06] bg-white/[0.015] glow-card"
                }`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-brand px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-ink">
                    Most popular
                  </span>
                )}
                <h3 className="text-sm font-semibold text-white/90">{plan.name}</h3>
                <p className="mt-1 text-[12px] text-white/35">{plan.desc}</p>
                <p className="mt-4 text-3xl font-bold text-white">
                  {plan.price}
                  <span className="text-xs font-normal text-white/30">/mo</span>
                </p>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12.5px] text-white/55">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`mt-6 block rounded-xl px-4 py-2.5 text-center text-[12.5px] font-bold transition-all duration-200 ${
                    plan.highlight
                      ? "bg-gradient-brand text-brand-ink glow-btn hover:scale-[1.03]"
                      : "border border-white/10 text-white/80 hover:border-white/20 hover:bg-white/[0.05]"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <p data-reveal className="mt-8 text-center text-[11.5px] text-white/25">
            No credit card required for Free · Cancel anytime · 14-day free trial on all paid plans
          </p>
        </div>
      </section>

      {/* ================================================================
          CTA
          ================================================================ */}
      <section className="relative px-4 py-28 sm:px-6">
        <div data-reveal className="glow-ring relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] px-8 py-16 text-center">
          {/* Background glow */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{ background: "radial-gradient(circle at 50% 50%, hsl(var(--glow-strong) / 0.2), transparent 70%)" }}
          />
          <div className="relative">
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-balance">
              Your next client is one search away.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[13.5px] text-white/40">
              Open the workspace, run a search for your city and niche, and see your first scored leads in seconds.
            </p>
            <Link
              href="/register"
              className="sheen group mt-8 inline-flex items-center gap-2.5 rounded-xl bg-gradient-brand px-7 py-3.5 text-sm font-bold text-brand-ink transition-all hover:scale-[1.04] hover:shadow-[0_0_30px_-6px_hsl(var(--glow-strong)/0.6)]"
            >
              Open LeadForge
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================
          FOOTER
          ================================================================ */}
      <footer className="relative border-t border-white/[0.04] px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-[11.5px] text-white/25 sm:flex-row">
          <span>© {new Date().getFullYear()} LeadForge INC. Built for web designers and agencies.</span>
          <div className="flex gap-5">
            <Link href="/login" className="transition-colors hover:text-white/60">Dashboard</Link>
            <a href="#product" className="transition-colors hover:text-white/60">Product</a>
            <a href="#pricing" className="transition-colors hover:text-white/60">Pricing</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
