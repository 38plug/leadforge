import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
];

export function LandingNav() {
  return (
    <div className="sticky top-4 z-50 mx-auto w-full max-w-5xl relative">
      {/* ambient glow behind the pill */}
      <div
        className="animate-nav-glow pointer-events-none absolute left-1/2 top-1/2 -z-10 h-24 w-[110%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "linear-gradient(90deg, hsl(var(--glow-strong) / 0.55), hsl(var(--glow-soft) / 0.4) 50%, hsl(var(--glow-strong) / 0.55))",
        }}
      />

      {/* animated gradient border ring */}
      <header
        className="animate-border-shift relative rounded-full p-[1.5px] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]"
        style={{
          backgroundImage:
            "linear-gradient(90deg, hsl(var(--glow-strong) / 0.9), hsl(var(--glow-soft) / 0.9), hsl(var(--glow-strong) / 0.9))",
          backgroundSize: "200% 100%",
        }}
      >
        <div className="flex items-center justify-between gap-4 rounded-full bg-[#0a1310]/95 px-3 py-2 backdrop-blur-xl">
          <Link href="/" className="group flex items-center gap-2.5 pl-2">
            <div className="transition-transform duration-300 group-hover:scale-110">
              <LogoMark size={30} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-white">LeadForge</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="relative rounded-full px-3.5 py-1.5 text-[13px] font-medium text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="hidden rounded-full px-3.5 py-1.5 text-[13px] font-medium text-white/80 transition-colors hover:text-white sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/dashboard"
              className="animate-pulse-glow inline-flex items-center rounded-full bg-gradient-brand px-4 py-1.5 text-[13px] font-bold text-brand-ink transition-transform hover:scale-[1.06]"
            >
              Open app
            </Link>
          </div>
        </div>
      </header>
    </div>
  );
}
