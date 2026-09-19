"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Loader2,
  ExternalLink,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState, SkeletonCards } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import type { ApiUsage } from "@/types/api";
import { cn } from "@/lib/utils";

interface PlanOption {
  plan: string;
  lead_limit: number;
  purchasable: boolean;
}

interface BillingState {
  current_plan: string;
  billing_configured: boolean;
  subscription_status: string | null;
  current_period_end: string | null;
  has_billing_account: boolean;
  plans: PlanOption[];
}

/** Presentation for each plan. Limits and purchasability come from the API. */
const PLAN_COPY: Record<string, { name: string; price: string; blurb: string; seats: string }> = {
  FREE: { name: "Free", price: "$0", blurb: "Try the product", seats: "1 seat" },
  STARTER: { name: "Starter", price: "$29", blurb: "For a solo designer", seats: "2 seats" },
  PRO: { name: "Pro", price: "$79", blurb: "For a busy freelancer", seats: "5 seats" },
  AGENCY: { name: "Agency", price: "$199", blurb: "For a small team", seats: "15 seats" },
};

/**
 * Plans, and the buttons that actually charge for them.
 *
 * Checkout and the portal are both hosted by Stripe, so no card details ever
 * reach this application. The panel's job is to say clearly what the customer
 * is on, what they would move to, and - when billing is not configured - that
 * nothing here can be bought yet, rather than showing buttons that fail.
 */
export function BillingPanel() {
  const { workspace } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  const { data: billing, loading, error, refetch } = useApi<BillingState>("/api/billing/plans");
  const { data: usage, refetch: refetchUsage } = useApi<ApiUsage>("/api/workspace/usage");

  const checkoutResult = searchParams.get("checkout");

  // Returning from Stripe, the plan may not have changed yet: access is
  // granted by webhook, which can land a moment after the redirect. Refetching
  // shortly after arrival avoids showing a stale plan to someone who just paid.
  useEffect(() => {
    if (checkoutResult !== "success") return;
    const timer = setTimeout(() => {
      refetch();
      refetchUsage();
    }, 2000);
    return () => clearTimeout(timer);
  }, [checkoutResult, refetch, refetchUsage]);

  async function startCheckout(plan: string) {
    setPendingPlan(plan);
    try {
      const { url } = await api.post<{ url: string }>("/api/billing/checkout", { plan });
      window.location.href = url;
    } catch (err) {
      setPendingPlan(null);
      toast({
        title: "Couldn't start checkout",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "error",
      });
    }
  }

  async function openPortal() {
    setOpeningPortal(true);
    try {
      const { url } = await api.post<{ url: string }>("/api/billing/portal");
      window.location.href = url;
    } catch (err) {
      setOpeningPortal(false);
      toast({
        title: "Couldn't open billing",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "error",
      });
    }
  }

  if (loading) return <SkeletonCards count={4} />;
  if (error) {
    return (
      <Card>
        <ErrorState title="Billing could not be loaded" message={error} onRetry={refetch} />
      </Card>
    );
  }
  if (!billing) return null;

  const currentPlan = workspace?.plan ?? billing.current_plan;
  const order = ["FREE", "STARTER", "PRO", "AGENCY"];
  const currentRank = order.indexOf(currentPlan);

  return (
    <div className="flex flex-col gap-4">
      {checkoutResult === "success" && (
        <div className="animate-rise-in flex items-start gap-3 rounded-lg border border-success/25 bg-success/[0.08] p-4">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Payment received — thank you. Your new plan appears here within a few seconds of
            Stripe confirming it.
          </p>
        </div>
      )}
      {checkoutResult === "cancelled" && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Checkout was cancelled — nothing was charged.
          </p>
        </div>
      )}

      {!billing.billing_configured && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/10 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <div className="text-[13px] leading-relaxed">
            <p className="font-medium text-warning">Payments are not connected yet</p>
            <p className="mt-0.5 text-muted-foreground">
              Plans are shown for reference, but nothing can be purchased until Stripe credentials
              are configured on the server.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------- what you are using */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>This week</CardTitle>
            <CardDescription>
              Leads unlocked against your allowance. It refills every Monday.
            </CardDescription>
          </div>
          {billing.has_billing_account && (
            <Button variant="secondary" size="sm" onClick={openPortal} disabled={openingPortal}>
              {openingPortal ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CreditCard className="h-3.5 w-3.5" />
              )}
              Manage subscription
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {usage && (
            <>
              <div className="flex items-end justify-between gap-3">
                <span className="numeric text-2xl font-semibold">
                  {usage.lead_reveals ?? 0}
                  <span className="ml-1.5 text-sm font-normal text-subtle-foreground">
                    / {(usage.lead_reveals_limit ?? 0).toLocaleString()} leads
                  </span>
                </span>
                <Badge variant={usage.quota_exhausted ? "warning" : "default"}>
                  {currentPlan}
                </Badge>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-700 ease-out",
                    usage.quota_exhausted ? "bg-warning" : "bg-primary"
                  )}
                  style={{
                    width: `${Math.min(
                      100,
                      ((usage.lead_reveals ?? 0) / Math.max(1, usage.lead_reveals_limit ?? 1)) * 100
                    )}%`,
                  }}
                />
              </div>
              {usage.quota_exhausted && (
                <p className="text-2xs text-warning">
                  You have used this week&apos;s allowance. Upgrade for a larger one, or wait for
                  Monday.
                </p>
              )}
            </>
          )}
          {billing.subscription_status && billing.subscription_status !== "INACTIVE" && (
            <p className="border-t border-border pt-3 text-2xs text-subtle-foreground">
              Subscription status: {billing.subscription_status}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------- the plans */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {billing.plans.map((option) => {
          const copy = PLAN_COPY[option.plan] ?? {
            name: option.plan,
            price: "—",
            blurb: "",
            seats: "",
          };
          const isCurrent = option.plan === currentPlan;
          const isDowngrade = order.indexOf(option.plan) < currentRank;
          const busy = pendingPlan === option.plan;

          return (
            <Card
              key={option.plan}
              className={cn("flex flex-col", isCurrent && "border-primary/40")}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{copy.name}</CardTitle>
                  {isCurrent && <Badge>Current</Badge>}
                </div>
                <p className="mt-1">
                  <span className="numeric text-2xl font-semibold">{copy.price}</span>
                  <span className="text-xs text-subtle-foreground">/month</span>
                </p>
                <CardDescription>{copy.blurb}</CardDescription>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col gap-2 pt-0">
                <ul className="flex flex-1 flex-col gap-1.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                    <span className="numeric">{option.lead_limit.toLocaleString()}</span> lead
                    unlocks a week
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                    {copy.seats}
                  </li>
                </ul>

                {isCurrent ? (
                  <Button variant="outline" size="sm" className="mt-2 w-full" disabled>
                    Current plan
                  </Button>
                ) : isDowngrade ? (
                  // Downgrades go through Stripe's portal, which handles
                  // proration and the end-of-period switch correctly.
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={openPortal}
                    disabled={!billing.has_billing_account}
                  >
                    Change in billing
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => startCheckout(option.plan)}
                    disabled={!option.purchasable || busy}
                    title={!option.purchasable ? "This plan is not available for purchase yet" : undefined}
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {busy ? "Opening Stripe..." : option.purchasable ? "Upgrade" : "Unavailable"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-2xs leading-relaxed text-subtle-foreground">
        Payments are processed by Stripe. Card details are entered on Stripe&apos;s own pages and
        never reach LeadForge.
      </p>
    </div>
  );
}
