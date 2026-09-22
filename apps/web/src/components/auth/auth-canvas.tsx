"use client";

import { LogoMark } from "@/components/brand/logo-mark";
import Link from "next/link";

/**
 * Cinematic auth canvas — replaces the split-panel generic layout.
 * Black canvas, thin outer frame, oversized headline, floating form panel,
 * abstract artwork, technical annotations.
 *
 * Forms are NOT rewritten — wrapped. All submit behavior, validation,
 * redirects, and field logic is preserved identically.
 */

/* ------------------------------------------------------------------ */
/*  Canvas + Frame                                                     */
/* ------------------------------------------------------------------ */

export function AuthCanvas({
  children,
  grain = true,
}: {
  children: React.ReactNode;
  grain?: boolean;
}) {
  return (
    <div
      className={`relative min-h-screen bg-[#050505] ${grain ? "grain-overlay vignette" : ""}`}
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 30%, hsl(82 100% 61% / 0.03), transparent 60%), #050505",
      }}
    >
      {children}
    </div>
  );
}

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="cinematic-frame mx-5 my-5 min-h-[calc(100vh-40px)] rounded-[10px] border border-white/[0.07] md:mx-8 md:my-8 md:min-h-[calc(100vh-64px)]">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Headline                                                           */
/* ------------------------------------------------------------------ */

export function AuthHeadline({
  label,
  lines,
  support,
}: {
  label: string;
  lines: string[];
  support: string;
}) {
  return (
    <div className="relative z-10">
      <span className="cinematic-label mb-5 inline-block text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 md:text-[10px]">
        {label}
      </span>

      <h1 className="font-bold leading-[0.88] tracking-[-0.04em] text-white">
        {lines.map((line, i) => (
          <span
            key={i}
            className="auth-headline-line my-1 block"
            style={{ animationDelay: `${0.2 + i * 0.15}s` }}
          >
            {i === lines.length - 1 ? (
              <span className="text-gradient-brand">{line}</span>
            ) : (
              line
            )}
          </span>
        ))}
      </h1>

      <p
        className="auth-headline-support mt-6 max-w-[320px] text-[12px] leading-relaxed text-white/30 md:text-[13px]"
        style={{ animationDelay: `${0.2 + lines.length * 0.15 + 0.1}s` }}
      >
        {support}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Panel — floating dark instrument                                   */
/* ------------------------------------------------------------------ */

export function AuthPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 w-full max-w-[400px]">
      {/* Glow behind panel */}
      <div
        className="pointer-events-none absolute -inset-20 -z-10 rounded-3xl opacity-30 blur-[80px]"
        style={{
          background:
            "radial-gradient(circle, hsl(82 100% 61% / 0.08), transparent 60%)",
        }}
      />

      <div className="auth-panel-enter overflow-hidden rounded-[8px] border border-white/[0.06] bg-[#080808]/95 shadow-[0_0_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-4 py-2.5">
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-white/6" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/6" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/6" />
          </div>
          <span className="ml-1 text-[8px] font-bold uppercase tracking-[0.15em] text-white/20">
            LeadForge
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <span
              className="h-1 w-1 rounded-full"
              style={{
                background: "hsl(82 100% 61%)",
                boxShadow: "0 0 6px hsl(82 100% 61% / 0.5)",
              }}
            />
            <span className="text-[7px] font-medium uppercase tracking-[0.15em] text-white/15">
              SECURE
            </span>
          </div>
        </div>

        {/* Form content — stagger entrance */}
        <div className="auth-panel-fields px-6 pt-6 pb-6">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Annotations                                                        */
/* ------------------------------------------------------------------ */

export function AuthAnnotations({
  items,
}: {
  items: { label: string; value?: string; top: string; left: string; right: string; bottom: string; delay?: number }[];
}) {
  return (
    <>
      {items.map((a, i) => (
        <div
          key={i}
          className="auth-annotation pointer-events-none absolute hidden lg:block"
          style={{
            top: a.top,
            left: a.left,
            right: a.right,
            bottom: a.bottom,
            animationDelay: `${a.delay ?? 0.2 + i * 0.08}s`,
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: "hsl(82 100% 61% / 0.5)",
                boxShadow: "0 0 8px hsl(82 100% 61% / 0.3)",
              }}
            />
            <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/20">
              {a.label}
            </span>
            {a.value && (
              <>
                <span className="h-px w-4 bg-white/[0.08]" />
                <span className="text-[8px] font-bold tabular-nums tracking-wider text-white/30">
                  {a.value}
                </span>
              </>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Artwork — abstract ribbon forms                                    */
/* ------------------------------------------------------------------ */

export function AuthArtwork() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Chrome ribbon — top right */}
      <div
        className="animate-ribbon-drift"
        style={{
          position: "absolute",
          top: "-10%",
          right: "-8%",
          width: "42vw",
          maxWidth: "480px",
          height: "55vh",
          maxHeight: "550px",
          borderRadius: "42% 58% 55% 45% / 48% 42% 58% 52%",
          background:
            "linear-gradient(155deg, hsl(0 0% 10%) 0%, hsl(82 30% 14%) 15%, hsl(0 0% 7%) 30%, hsl(82 35% 18%) 50%, hsl(0 0% 5%) 70%, hsl(82 25% 12%) 90%)",
          transform: "rotate(-18deg)",
          opacity: 0.4,
          WebkitMaskImage:
            "radial-gradient(ellipse at 35% 30%, black 18%, transparent 60%)",
          maskImage:
            "radial-gradient(ellipse at 35% 30%, black 18%, transparent 60%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            background:
              "linear-gradient(200deg, transparent 20%, hsl(0 0% 100% / 0.1) 35%, transparent 45%, hsl(82 100% 61% / 0.06) 60%, transparent 70%)",
          }}
        />
      </div>

      {/* Lime ribbon — bottom left */}
      <div
        className="animate-ribbon-drift-alt"
        style={{
          position: "absolute",
          bottom: "-12%",
          left: "-10%",
          width: "38vw",
          maxWidth: "440px",
          height: "50vh",
          maxHeight: "500px",
          borderRadius: "55% 45% 48% 52% / 42% 58% 42% 58%",
          background:
            "linear-gradient(145deg, hsl(0 0% 6%) 0%, hsl(82 45% 16%) 20%, hsl(0 0% 8%) 40%, hsl(82 35% 13%) 60%, hsl(0 0% 5%) 80%, hsl(82 50% 18%) 100%)",
          transform: "rotate(20deg)",
          opacity: 0.3,
          WebkitMaskImage:
            "radial-gradient(ellipse at 55% 45%, black 16%, transparent 55%)",
          maskImage:
            "radial-gradient(ellipse at 55% 45%, black 16%, transparent 55%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            background:
              "linear-gradient(180deg, transparent 10%, hsl(82 100% 61% / 0.1) 30%, transparent 50%)",
          }}
        />
      </div>

      {/* Amber accent — small, center-left */}
      <div
        className="animate-ribbon-drift-slow"
        style={{
          position: "absolute",
          top: "38%",
          left: "12%",
          width: "16vw",
          maxWidth: "200px",
          height: "28vh",
          maxHeight: "280px",
          borderRadius: "48% 52% 58% 42% / 52% 48% 52% 48%",
          background:
            "linear-gradient(155deg, hsl(0 0% 5%) 0%, hsl(28 60% 18%) 30%, hsl(0 0% 7%) 50%, hsl(28 50% 14%) 70%, hsl(0 0% 4%) 100%)",
          transform: "rotate(-25deg)",
          opacity: 0.2,
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 40%, black 10%, transparent 50%)",
          maskImage:
            "radial-gradient(ellipse at 50% 40%, black 10%, transparent 50%)",
        }}
      />

      {/* Lime glow orb */}
      <div
        className="animate-breathe"
        style={{
          position: "absolute",
          top: "25%",
          right: "20%",
          width: "180px",
          height: "180px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, hsl(82 100% 61% / 0.06), transparent 60%)",
          filter: "blur(30px)",
        }}
      />

      {/* Amber glow orb */}
      <div
        className="animate-breathe"
        style={{
          position: "absolute",
          bottom: "15%",
          left: "35%",
          width: "140px",
          height: "140px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, hsl(28 85% 55% / 0.04), transparent 60%)",
          filter: "blur(25px)",
          animationDelay: "-3s",
        }}
      />

      {/* Thin flowing line */}
      <div
        style={{
          position: "absolute",
          top: "55%",
          right: "15%",
          width: "22vw",
          maxWidth: "260px",
          height: "1px",
          background:
            "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.1), hsl(82 100% 61% / 0.12), transparent)",
          borderRadius: "999px",
          transform: "rotate(-6deg)",
          opacity: 0.6,
        }}
      />

      {/* Lime dot */}
      <div
        className="animate-breathe"
        style={{
          position: "absolute",
          top: "20%",
          right: "32%",
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: "hsl(82 100% 61% / 0.4)",
          boxShadow:
            "0 0 12px hsl(82 100% 61% / 0.3), 0 0 24px hsl(82 100% 61% / 0.1)",
        }}
      />

      {/* Amber dot */}
      <div
        className="animate-breathe"
        style={{
          position: "absolute",
          top: "62%",
          left: "28%",
          width: "4px",
          height: "4px",
          borderRadius: "50%",
          background: "hsl(28 85% 55% / 0.35)",
          boxShadow: "0 0 10px hsl(28 85% 55% / 0.25)",
          animationDelay: "-3s",
        }}
      />

      {/* Second chrome piece — bottom right */}
      <div
        className="animate-ribbon-drift"
        style={{
          position: "absolute",
          bottom: "3%",
          right: "-5%",
          width: "28vw",
          maxWidth: "320px",
          height: "32vh",
          maxHeight: "320px",
          borderRadius: "52% 48% 45% 55% / 50% 55% 45% 50%",
          background:
            "linear-gradient(170deg, hsl(0 0% 7%) 0%, hsl(82 18% 12%) 25%, hsl(0 0% 5%) 50%, hsl(82 22% 10%) 75%, hsl(0 0% 6%) 100%)",
          transform: "rotate(12deg)",
          opacity: 0.25,
          WebkitMaskImage:
            "radial-gradient(ellipse at 45% 50%, black 12%, transparent 50%)",
          maskImage:
            "radial-gradient(ellipse at 45% 50%, black 12%, transparent 50%)",
          animationDelay: "-8s",
          animationDuration: "25s",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Floating Product Fragment (visual only)                            */
/* ------------------------------------------------------------------ */

export function AuthProductFragment() {
  return (
    <div className="pointer-events-none absolute hidden xl:block" style={{ bottom: "12%", right: "6%" }}>
      <div
        className="cinematic-panel rounded-[6px] border border-white/[0.04] bg-[#0a0a0a]/80 px-4 py-3 backdrop-blur-md"
        style={{ maxWidth: "240px" }}
      >
        <div className="mb-2 flex items-center gap-1.5">
          <span
            className="h-1 w-1 rounded-full"
            style={{
              background: "hsl(0 0% 30%)",
              animation: "status-pulse 3s ease-in-out infinite",
            }}
          />
          <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-white/15">
            SYSTEM STANDBY
          </span>
        </div>
        <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/20">
          OPPORTUNITY ENGINE
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-xl font-bold tabular-nums text-white/50">
            94
          </span>
          <span className="text-[8px] font-medium text-white/20">
            HIGH POTENTIAL
          </span>
        </div>
        <div className="mt-1 text-[7px] font-medium text-white/10">
          [SCAN_IDLE]
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page Footer / Status                                               */
/* ------------------------------------------------------------------ */

export function AuthStatus() {
  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-center justify-between px-6 py-4 text-[8px] font-medium uppercase tracking-[0.15em] text-white/10 md:px-10">
      <span>LeadForge INC</span>
      <span className="flex items-center gap-1.5">
        <span
          className="h-0.5 w-0.5 rounded-full"
          style={{
            background: "hsl(82 100% 61% / 0.4)",
            boxShadow: "0 0 4px hsl(82 100% 61% / 0.2)",
          }}
        />
        ENCRYPTED
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AuthField — REEXPORT from existing (unchanged)                     */
/* ------------------------------------------------------------------ */

export { AuthField } from "@/components/auth/auth-layout";
