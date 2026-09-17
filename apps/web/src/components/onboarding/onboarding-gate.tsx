"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { WelcomeOverlay } from "./welcome-overlay";
import { ProductTour } from "./product-tour";

/** Set by register() so the greeting plays exactly once, right after sign-up. */
export const JUST_REGISTERED_KEY = "leadforge.just-registered";

const tourKey = (userId: string) => `leadforge.tour-dismissed.${userId}`;

type Phase = "idle" | "welcome" | "tour";

/**
 * Decides whether a signed-in user sees the post-sign-up greeting and the
 * product tour. Everything is read from storage inside an effect so the server
 * and the first client render agree (phase always starts "idle").
 */
export function OnboardingGate() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (!user) return;

    let justRegistered = false;
    let dismissed = false;
    try {
      justRegistered = sessionStorage.getItem(JUST_REGISTERED_KEY) === "1";
      if (justRegistered) sessionStorage.removeItem(JUST_REGISTERED_KEY);
      dismissed = localStorage.getItem(tourKey(user.id)) === "1";
    } catch {
      // Storage can be unavailable (private mode, blocked cookies). Staying
      // quiet is the right default — never block the app on a tour.
      return;
    }

    if (justRegistered) setPhase("welcome");
    else if (!dismissed) setPhase("tour");
  }, [user]);

  const finishTour = useCallback(
    (neverShowAgain: boolean) => {
      setPhase("idle");
      if (!neverShowAgain || !user) return;
      try {
        localStorage.setItem(tourKey(user.id), "1");
      } catch {
        // Nothing to do — the tour simply shows again next time.
      }
    },
    [user]
  );

  const finishWelcome = useCallback(() => {
    if (!user) return setPhase("idle");
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(tourKey(user.id)) === "1";
    } catch {
      /* treat as not dismissed */
    }
    setPhase(dismissed ? "idle" : "tour");
  }, [user]);

  if (!user) return null;
  if (phase === "welcome") {
    return <WelcomeOverlay name={user.full_name || user.email} onDone={finishWelcome} />;
  }
  if (phase === "tour") return <ProductTour onClose={finishTour} />;
  return null;
}
