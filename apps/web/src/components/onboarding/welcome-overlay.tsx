"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/logo-mark";

/**
 * A short, one-time greeting shown immediately after sign-up, before the
 * product tour. Auto-dismisses so it never blocks someone who just wants to
 * get to work.
 */
export function WelcomeOverlay({ name, onDone }: { name: string; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Held longer than it takes to read. This plays once, immediately after
    // someone commits to creating an account, and hurrying it past them wastes
    // the one moment they are actually looking at the product rather than
    // through it. The progress bar below finishes at 4.4s; the overlay begins
    // leaving after that, not during.
    const leaveTimer = setTimeout(() => setLeaving(true), 5200);
    const doneTimer = setTimeout(onDone, 6000);
    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  const firstName = name.trim().split(/\s+/)[0] || name;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[120] flex items-center justify-center bg-[#08090C]/95 backdrop-blur-sm transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* ambient glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-[120px]"
        style={{ background: "radial-gradient(circle, hsl(var(--glow-strong) / 0.55), transparent 65%)" }}
      />

      <div className="relative flex flex-col items-center gap-5 px-6 text-center">
        <div className="animate-welcome-pop">
          <LogoMark size={64} />
        </div>

        <div className="animate-welcome-rise">
          <h1 className="text-[clamp(1.6rem,4vw,2.4rem)] font-semibold tracking-tight text-white">
            Welcome, <span className="text-gradient-brand">{firstName}</span>
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Your workspace is ready. Let&apos;s find your first client.
          </p>
        </div>

        <div className="animate-welcome-rise-delayed h-0.5 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="animate-welcome-bar h-full rounded-full bg-gradient-brand" />
        </div>
      </div>
    </div>
  );
}
