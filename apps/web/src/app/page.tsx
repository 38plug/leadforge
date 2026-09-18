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
} from "lucide-react";
import { LandingNav } from "@/components/marketing/landing-nav";
import { HeroMockup } from "@/components/marketing/hero-mockup";
import { LogoPattern } from "@/components/brand/logo-pattern";

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

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#08090C] text-white">
      {/* repeated logo watermark — subtle brand texture, never behind body copy */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <LogoPattern opacity={0.02} className="absolute inset-0" />
      </div>

      {/* ambient glow field — spans the whole page, not just the hero */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-[-14%] h-[640px] w-[1000px] -translate-x-1/2 rounded-full opacity-60 blur-[130px]"
          style={{ background: "radial-gradient(circle, hsl(var(--glow-strong) / 0.7), transparent 65%)" }}
        />
        <div
          className="absolute right-[-12%] top-[14%] h-[460px] w-[460px] rounded-full opacity-50 blur-[120px]"
          style={{ background: "radial-gradient(circle, hsl(var(--violet) / 0.65), transparent 65%)" }}
        />
        <div
          className="absolute left-[-10%] top-[52%] h-[420px] w-[420px] rounded-full opacity-35 blur-[130px]"
          style={{ background: "radial-gradient(circle, hsl(var(--glow-strong) / 0.55), transparent 65%)" }}
        />
        <div
          className="absolute right-[8%] top-[85%] h-[500px] w-[500px] rounded-full opacity-40 blur-[140px]"
          style={{ background: "radial-gradient(circle, hsl(var(--violet) / 0.5), transparent 65%)" }}
        />
      </div>

      <div className="relative px-4 pt-6 sm:px-6">
        <LandingNav />
      </div>

      {/* pricing */}
      <section id="pricing" className="relative px-4 pb-4 pt-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-xl text-center">
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">Pricing</span>
            <h2 className="mt-3 text-[clamp(1.5rem,3vw,2.25rem)] font-semibold tracking-tight text-balance">
              One new client pays for a year of LeadForge
            </h2>
            <p className="mt-3 text-[13.5px] text-white/50">
              Start free. No credit card required. Upgrade only once leads are turning into real pipeline.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-6 transition-transform duration-200 hover:-translate-y-1 ${
                  plan.highlight
                    ? "border-transparent bg-gradient-brand-wash glow-ring animate-pulse-glow"
                    : "glow-card border-white/[0.08] bg-white/[0.02]"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-brand px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-ink">
                    Most popular
                  </span>
                )}
                <h3 className="text-sm font-semibold text-white">{plan.name}</h3>
                <p className="mt-1 text-[12px] text-white/45">{plan.desc}</p>
                <p className="mt-4 text-3xl font-semibold text-white">
                  {plan.price}
                  <span className="text-xs font-normal text-white/40">/mo</span>
                </p>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12.5px] text-white/65">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "hsl(var(--glow-strong))" }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/dashboard"
                  className={`mt-6 block rounded-full px-4 py-2 text-center text-[12.5px] font-bold transition-all hover:scale-[1.03] ${
                    plan.highlight
                      ? "bg-gradient-brand text-brand-ink glow-btn"
                      : "border border-white/15 text-white/85 hover:bg-white/[0.06]"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-[11.5px] text-white/35">
            No credit card required for Free · Cancel anytime · 14-day free trial on all paid plans
          </p>
        </div>
      </section>

      {/* hero */}
      <section className="relative px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto flex max-w-6xl flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-white/60">
            <Sparkles className="h-3 w-3" />
            AI-powered client acquisition
          </span>

          <h1 className="mt-6 max-w-3xl text-[clamp(2.25rem,5.5vw,4rem)] font-semibold leading-[1.08] tracking-tight text-balance">
            Find businesses that are{" "}
            <span className="text-gradient-brand">ready for a better website</span>
          </h1>

          <p className="mt-5 max-w-xl text-balance text-[15px] leading-relaxed text-white/55 sm:text-base">
            LeadForge discovers local businesses with no website (or a bad one), scores the
            opportunity, and helps you turn it into a client — from first search to signed proposal.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="group animate-pulse-glow inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-3 text-sm font-bold text-brand-ink transition-transform hover:scale-[1.05]"
            >
              Start finding leads
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white/85 transition-all hover:border-white/30 hover:bg-white/[0.08]"
            >
              View live dashboard
            </Link>
          </div>

          <p className="mt-4 text-[11px] text-white/35">
            No credit card required · Mock data providers included for local development
          </p>
        </div>

        <div className="relative mx-auto mt-16 max-w-3xl">
          <HeroMockup />
        </div>
      </section>

      {/* stats strip */}
      <section id="how-it-works" className="relative border-y border-white/[0.06] bg-white/[0.015] px-4 py-10 sm:px-6">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-semibold tracking-tight text-gradient-brand">{s.value}</p>
              <p className="mx-auto mt-1.5 max-w-[220px] text-[12.5px] leading-snug text-white/45">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section id="product" className="relative px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-xl text-center">
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">How it works</span>
            <h2 className="mt-3 text-[clamp(1.5rem,3vw,2.25rem)] font-semibold tracking-tight text-balance">
              Every step from discovery to close, in one workspace
            </h2>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="glow-card group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition-all duration-200 hover:-translate-y-1 hover:bg-white/[0.05]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand-wash transition-transform duration-200 group-hover:scale-110">
                  <f.icon className="h-5 w-5" style={{ color: "hsl(var(--glow-strong))" }} />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-white/50">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-4 py-24 sm:px-6">
        <div className="glow-ring relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] px-8 py-14 text-center">
          <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-tight text-balance">
            Your next client is one search away.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[13.5px] text-white/50">
            Open the workspace, run a search for your city and niche, and see your first scored leads in seconds.
          </p>
          <Link
            href="/dashboard"
            className="group animate-pulse-glow mt-7 inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-3 text-sm font-bold text-brand-ink transition-transform hover:scale-[1.05]"
          >
            Open LeadForge
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      <footer className="relative border-t border-white/[0.06] px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-[11.5px] text-white/35 sm:flex-row">
          <span>© {new Date().getFullYear()} LeadForge. Built for web designers and agencies.</span>
          <div className="flex gap-5">
            <Link href="/dashboard" className="hover:text-white/70">Dashboard</Link>
            <a href="#product" className="hover:text-white/70">Product</a>
            <a href="#pricing" className="hover:text-white/70">Pricing</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
