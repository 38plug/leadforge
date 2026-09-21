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
  Shield,
  BarChart3,
} from "lucide-react";
import { LandingNav } from "@/components/marketing/landing-nav";
import { HeroMockup } from "@/components/marketing/hero-mockup";

const FEATURES = [
  {
    icon: Search,
    title: "Discover the right businesses",
    body: "Filter by country, city, and niche to surface local businesses that match your ideal client profile.",
    wide: true,
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
    body: "Turn a lead into a personalized email, call script, or Instagram DM in one click.",
  },
  {
    icon: KanbanSquare,
    title: "Built-in CRM pipeline",
    body: "Move leads from New to Won across a 9-stage Kanban board with activity history and follow-up reminders.",
    wide: true,
  },
  {
    icon: Shield,
    title: "Compliant campaigns",
    body: "Suppression lists, unsubscribe handling, and sending limits are built in from day one.",
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
      {Array.from({ length: 24 }).map((_, i) => (
        <div key={`p-${i}`} className="particle" />
      ))}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={`pl-${i}`} className="particle particle-lg" />
      ))}
      <div className="hero-network">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`l-${i}`} className="line" />
        ))}
      </div>
    </div>
  );
}

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
      { threshold: 0.08, rootMargin: "0px 0px -60px 0px" }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#030303] text-white">
      {/* ============================================================
          ATMOSPHERE — Multi-layer aurora glows
          ============================================================ */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Primary lime glow — large, centered */}
        <div
          className="absolute left-1/2 top-[-25%] h-[900px] w-[1200px] -translate-x-1/2 rounded-full blur-[200px]"
          style={{
            background: "radial-gradient(circle, hsl(var(--glow-strong) / 0.35), transparent 55%)",
            opacity: 0.6,
          }}
        />
        {/* Secondary warm glow — right */}
        <div
          className="absolute right-[-20%] top-[5%] h-[600px] w-[600px] rounded-full blur-[180px]"
          style={{
            background: "radial-gradient(circle, hsl(var(--glow-soft) / 0.25), transparent 55%)",
            opacity: 0.5,
          }}
        />
        {/* Tertiary — left low */}
        <div
          className="absolute left-[-15%] top-[55%] h-[500px] w-[500px] rounded-full blur-[170px]"
          style={{
            background: "radial-gradient(circle, hsl(var(--glow-strong) / 0.2), transparent 55%)",
            opacity: 0.4,
          }}
        />
        {/* Deep accent — bottom right */}
        <div
          className="absolute right-[5%] top-[80%] h-[550px] w-[550px] rounded-full blur-[190px]"
          style={{
            background: "radial-gradient(circle, hsl(82 60% 40% / 0.3), transparent 55%)",
            opacity: 0.35,
          }}
        />
      </div>

      {/* Dot grid texture */}
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-50" />

      {/* Navigation */}
      <div className="relative px-4 pt-6 sm:px-6">
        <LandingNav />
      </div>

      {/* ============================================================
          HERO — Cinematic centerpiece
          ============================================================ */}
      <section className="relative px-4 pb-24 pt-24 sm:px-6 sm:pt-36">
        <ParticlesField />

        <div className="relative mx-auto flex max-w-6xl flex-col items-center text-center">
          {/* Badge */}
          <div
            data-reveal
            className="glass inline-flex items-center gap-2 rounded-full px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-primary"
          >
            <Zap className="h-3 w-3" />
            AI-powered client acquisition
          </div>

          {/* Headline — KaultAI-scale */}
          <h1
            data-reveal
            className="mt-10 max-w-5xl text-[clamp(3rem,7vw,5.5rem)] font-bold leading-[0.98] tracking-[-0.03em] text-balance"
          >
            Find businesses that{" "}
            <span className="text-gradient-brand">need you</span>
          </h1>

          {/* Subtext */}
          <p
            data-reveal
            className="mt-8 max-w-lg text-balance text-[16px] leading-relaxed text-white/40 sm:text-[17px]"
          >
            Discover businesses with untapped digital potential, understand their
            opportunity, and turn them into qualified clients.
          </p>

          {/* CTAs */}
          <div data-reveal className="mt-12 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="sheen group inline-flex items-center gap-3 rounded-2xl bg-gradient-brand px-8 py-4 text-[15px] font-bold text-brand-ink transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_40px_-8px_hsl(var(--glow-strong)/0.7)]"
            >
              Start finding leads
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="glass inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-[15px] font-semibold text-white/60 transition-all duration-300 hover:text-white hover:shadow-[0_0_30px_-10px_rgba(255,255,255,0.1)]"
            >
              Explore platform
            </Link>
          </div>

          {/* Trust line */}
          <div data-reveal className="mt-10 flex items-center gap-4 text-[11px] font-medium uppercase tracking-[0.15em] text-white/20">
            <span>AI-POWERED</span>
            <span className="h-1 w-1 rounded-full bg-white/15" />
            <span>REAL-TIME DATA</span>
            <span className="h-1 w-1 rounded-full bg-white/15" />
            <span>BUILT FOR AGENCIES</span>
          </div>
        </div>

        {/* Hero mockup */}
        <div data-reveal className="relative mx-auto mt-24 max-w-4xl">
          <HeroMockup />
        </div>
      </section>

      {/* ============================================================
          STATS STRIP
          ============================================================ */}
      <section id="how-it-works" data-reveal className="relative px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="glass-card-static rounded-2xl px-8 py-10">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              {STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-[clamp(2rem,4vw,3.5rem)] font-bold tracking-[-0.03em] text-gradient-brand">{s.value}</p>
                  <p className="mx-auto mt-2 max-w-[200px] text-[12px] leading-snug text-white/30">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FEATURES — Bento Grid
          ============================================================ */}
      <section id="product" className="relative px-4 py-28 sm:px-6 sm:py-36">
        <div className="mx-auto max-w-6xl">
          <div data-reveal className="mx-auto max-w-xl text-center">
            <span className="label-caps text-primary">How it works</span>
            <h2 className="mt-5 text-[clamp(1.8rem,3.5vw,2.75rem)] font-bold tracking-[-0.02em] text-balance">
              Every step from discovery to close
            </h2>
          </div>

          <div className="bento-grid mt-16">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                data-reveal
                className={`glass-card gradient-border group p-7 ${
                  f.wide ? "bento-item-wide" : "bento-item-third"
                }`}
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/[0.07] transition-all duration-400 group-hover:scale-110 group-hover:bg-primary/[0.12]">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-5 text-[16px] font-bold text-white/90">{f.title}</h3>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-white/35">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          PRICING
          ============================================================ */}
      <section id="pricing" className="relative px-4 py-28 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div data-reveal className="mx-auto max-w-xl text-center">
            <span className="label-caps text-primary">Pricing</span>
            <h2 className="mt-5 text-[clamp(1.8rem,3.5vw,2.75rem)] font-bold tracking-[-0.02em] text-balance">
              One new client pays for a year
            </h2>
            <p className="mt-3 text-[14px] text-white/35">
              Start free. No credit card required.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                name: "Free",
                price: "$0",
                desc: "Try the full workflow",
                features: ["50 lead searches/mo", "10 AI analyses/mo", "1 seat", "CRM & scoring"],
                cta: "Start for free",
              },
              {
                name: "Starter",
                price: "$29",
                desc: "For freelancers",
                features: ["500 lead searches/mo", "100 AI analyses/mo", "2 seats", "Email outreach"],
                cta: "Start free trial",
              },
              {
                name: "Pro",
                price: "$79",
                desc: "For steady outreach",
                features: ["2,000 lead searches/mo", "500 AI analyses/mo", "5 seats", "Priority AI"],
                cta: "Start free trial",
                highlight: true,
              },
              {
                name: "Agency",
                price: "$199",
                desc: "For teams",
                features: ["10,000 lead searches/mo", "2,500 AI analyses/mo", "15 seats", "Onboarding"],
                cta: "Start free trial",
              },
            ].map((plan, i) => (
              <div
                key={plan.name}
                data-reveal
                className={`glass-card relative flex flex-col p-6 ${
                  plan.highlight ? "glow-ring border-primary/20" : ""
                }`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-brand px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-ink">
                    Most popular
                  </span>
                )}
                <h3 className="text-sm font-bold text-white/90">{plan.name}</h3>
                <p className="mt-1 text-[11px] text-white/30">{plan.desc}</p>
                <p className="mt-5 text-3xl font-bold text-white">
                  {plan.price}
                  <span className="text-xs font-normal text-white/25">/mo</span>
                </p>
                <ul className="mt-6 flex flex-col gap-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[12px] text-white/50">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`mt-auto block rounded-xl px-4 py-3 text-center text-[13px] font-bold transition-all duration-300 ${
                    plan.highlight
                      ? "bg-gradient-brand text-brand-ink glow-btn hover:scale-[1.02]"
                      : "glass border border-white/8 text-white/75 hover:border-white/15 hover:text-white"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <p data-reveal className="mt-10 text-center text-[11px] text-white/20">
            No credit card required for Free · Cancel anytime · 14-day free trial on all paid plans
          </p>
        </div>
      </section>

      {/* ============================================================
          CTA
          ============================================================ */}
      <section className="relative px-4 py-32 sm:px-6">
        <div data-reveal className="glass-card glow-ring relative mx-auto max-w-4xl overflow-hidden px-10 py-20 text-center">
          <div
            className="pointer-events-none absolute inset-0 opacity-25"
            style={{ background: "radial-gradient(circle at 50% 50%, hsl(var(--glow-strong) / 0.25), transparent 65%)" }}
          />
          <div className="relative">
            <h2 className="text-[clamp(1.8rem,3.5vw,2.5rem)] font-bold tracking-[-0.02em] text-balance">
              Your next client is one search away.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[14px] text-white/35">
              Open the workspace, run a search, and see scored leads in seconds.
            </p>
            <Link
              href="/register"
              className="sheen group mt-10 inline-flex items-center gap-3 rounded-2xl bg-gradient-brand px-8 py-4 text-[15px] font-bold text-brand-ink transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_40px_-8px_hsl(var(--glow-strong)/0.7)]"
            >
              Open LeadForge
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          FOOTER
          ============================================================ */}
      <footer className="relative border-t border-white/[0.04] px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-[11px] text-white/20 sm:flex-row">
          <span>© {new Date().getFullYear()} LeadForge INC. Built for web designers and agencies.</span>
          <div className="flex gap-6">
            <Link href="/login" className="transition-colors hover:text-white/50">Dashboard</Link>
            <a href="#product" className="transition-colors hover:text-white/50">Product</a>
            <a href="#pricing" className="transition-colors hover:text-white/50">Pricing</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
