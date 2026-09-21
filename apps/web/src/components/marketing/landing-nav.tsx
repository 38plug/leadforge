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
      <header className="glass relative rounded-2xl px-5 py-3.5">
        {/* Top highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-2xl bg-gradient-to-r from-transparent via-white/8 to-transparent" />

        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="group flex items-center gap-3">
            <div className="transition-transform duration-300 group-hover:scale-110">
              <LogoMark size={28} />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-white">LeadForge</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-4 py-2 text-[13px] font-medium text-white/40 transition-all duration-200 hover:bg-white/[0.05] hover:text-white/80"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-lg px-4 py-2 text-[13px] font-medium text-white/50 transition-colors hover:text-white/80 sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="sheen inline-flex items-center rounded-xl bg-gradient-brand px-5 py-2.5 text-[13px] font-bold text-brand-ink transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_24px_-4px_hsl(var(--glow-strong)/0.5)]"
            >
              Open app
            </Link>
          </div>
        </div>
      </header>
    </div>
  );
}
