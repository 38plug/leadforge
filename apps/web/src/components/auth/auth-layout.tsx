import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { LogoMark } from "@/components/brand/logo-mark";

/**
 * Shared frame for sign-in and sign-up.
 *
 * Split layout: the left panel states what the product does, the right holds
 * the form. Below lg the panel is dropped rather than stacked - on a phone it
 * would push the form under the fold, and someone opening a login screen is
 * there to log in, not to read positioning.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[1.05fr_1fr]">
      {/* ------------------------------------------------------------- brand */}
      <aside className="relative hidden overflow-hidden border-r border-border lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="grid-bg absolute inset-0" aria-hidden="true" />
        {/* Two blooms on different, deliberately long cycles. They drift in
            and out of phase, so the background never repeats visibly. */}
        <div
          className="aurora-slow pointer-events-none absolute -left-1/4 top-[-20%] h-[620px] w-[620px] rounded-full blur-[130px]"
          style={{ background: "radial-gradient(circle, hsl(var(--glow-strong) / 0.24), transparent 65%)" }}
          aria-hidden="true"
        />
        <div
          className="aurora-slower pointer-events-none absolute bottom-[-25%] left-[10%] h-[520px] w-[520px] rounded-full blur-[140px]"
          style={{ background: "radial-gradient(circle, hsl(var(--glow-soft) / 0.18), transparent 65%)" }}
          aria-hidden="true"
        />

        <Link href="/" className="relative flex items-center gap-2.5">
          <LogoMark size={26} />
          <span className="text-[15px] font-semibold tracking-tight">LeadForge</span>
        </Link>

        <div className="relative max-w-md">
          <h2 className="auth-enter-1 text-[34px] font-semibold leading-[1.12] tracking-tight">
            Find businesses.
            <br />
            Find opportunities.
            <br />
            <span className="text-gradient-brand">Find your next client.</span>
          </h2>
          <p className="auth-enter-2 mt-5 text-sm leading-relaxed text-muted-foreground">
            LeadForge discovers real local businesses, checks whether their web presence holds up,
            and scores each one so you know who is worth approaching first.
          </p>

          <ul className="auth-enter-3 mt-8 flex flex-col gap-3">
            {[
              "Real businesses from OpenStreetMap — never invented",
              "Website status checked live, not guessed",
              "A transparent score that shows its reasoning",
            ].map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
                <span
                  className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary"
                  style={{ boxShadow: "0 0 8px hsl(var(--glow-strong))" }}
                  aria-hidden="true"
                />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-2xs text-subtle-foreground">
          Business data © OpenStreetMap contributors
        </p>
      </aside>

      {/* -------------------------------------------------------------- form */}
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LogoMark size={26} />
            <span className="text-[15px] font-semibold tracking-tight">LeadForge</span>
          </Link>

          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

          <div className="mt-7">{children}</div>

          {footer && (
            <div className="mt-7 text-center text-[13px] text-muted-foreground">{footer}</div>
          )}
        </div>
      </main>
    </div>
  );
}

/** Labelled field used by both auth forms. */
export function AuthField({
  id,
  label,
  type,
  ...props
}: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const isPassword = type === "password";
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && visible ? "text" : type}
          className="h-10 w-full rounded-md border border-input bg-background/60 px-3 pr-10 text-sm text-foreground transition-colors placeholder:text-subtle-foreground hover:border-border-strong focus:border-primary/50 focus:bg-background"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-subtle-foreground transition-colors hover:text-foreground"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
