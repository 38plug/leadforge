import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";

export function LandingNav() {
  return (
    <nav className="flex items-center justify-between px-1 py-1">
      {/* Left: logo + label */}
      <Link href="/" className="group flex items-center gap-2">
        <LogoMark size={18} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50 group-hover:text-white/80 transition-colors">
          LeadForge
        </span>
      </Link>

      {/* Center: technical label */}
      <div className="hidden items-center gap-3 sm:flex">
        <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-white/20">
          AI Client Acquisition
        </span>
        <span className="h-px w-3 bg-white/10" />
        <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-white/20">
          System / Active
        </span>
      </div>

      {/* Right: nav + CTA */}
      <div className="flex items-center gap-3">
        <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-white/15 hidden sm:inline">
          2026
        </span>
        <Link
          href="/login"
          className="text-[10px] font-medium uppercase tracking-[0.1em] text-white/35 transition-colors hover:text-white/70"
        >
          Log in
        </Link>
        <Link
          href="/register"
          className="sheen rounded-md bg-gradient-brand px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-brand-ink transition-all hover:scale-[1.04]"
        >
          Open app
        </Link>
      </div>
    </nav>
  );
}
