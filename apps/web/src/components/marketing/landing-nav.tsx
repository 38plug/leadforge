import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
];

export function LandingNav() {
  return (
    <div className="sticky top-4 z-50 mx-auto w-full max-w-5xl">
      <header className="glass relative rounded-2xl px-4 py-3">
        {/* subtle top-edge highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="transition-transform duration-300 group-hover:scale-110">
              <LogoMark size={28} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-white">LeadForge</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="relative rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-white/50 transition-all duration-200 hover:bg-white/[0.06] hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-white/60 transition-colors hover:text-white sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="sheen inline-flex items-center rounded-lg bg-gradient-brand px-4 py-2 text-[13px] font-bold text-brand-ink transition-all hover:scale-[1.04] hover:shadow-[0_0_20px_-4px_hsl(var(--glow-strong)/0.6)]"
            >
              Open app
            </Link>
          </div>
        </div>
      </header>
    </div>
  );
}
