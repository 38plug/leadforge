"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export const ADMIN_PLANS = ["FREE", "STARTER", "PRO", "AGENCY", "BUSINESS"];

/**
 * Changes the plan a workspace is on, from anywhere in the admin area.
 *
 * Shared by the Accounts and Workspaces screens so both warn about the same
 * two things, in the same words. Duplicating the control is how one copy ends
 * up silently dropping a warning the other still shows.
 *
 * The plan belongs to the workspace, never to a person, so a change made from
 * one member's row lands on every member of that workspace. The caller passes
 * `memberCount` so this can say so before anything happens.
 */
export function PlanSelect({
  workspaceId,
  workspaceName,
  plan,
  memberCount = 1,
  paymentProvider = null,
  onChanged,
  className,
  compact = false,
}: {
  workspaceId: string;
  workspaceName: string;
  plan: string;
  memberCount?: number;
  /** "stripe" when a real subscription backs this plan; null when comped. */
  paymentProvider?: string | null;
  onChanged?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function change(next: string) {
    if (next === plan) return;

    // Everyone in the workspace is affected, not just the row this was
    // clicked from. Said first because it is the part an admin acting on one
    // person's account is least likely to have in mind.
    const sharedNote =
      memberCount > 1
        ? `The plan belongs to the workspace, so this changes it for all ${memberCount} members.\n\n`
        : "";

    // Granting a paid plan here charges nobody and never renews. Confirming
    // makes that explicit, because the dropdown looks identical to one that
    // would take payment.
    if (next !== "FREE" && !paymentProvider) {
      const proceed = window.confirm(
        `Give ${workspaceName} the ${next} plan without charging for it?\n\n` +
          sharedNote +
          "This grants access immediately and does not create a subscription, so " +
          "it will not renew or bill. Use it for comped and partnership accounts."
      );
      if (!proceed) return;
    } else if (next === "FREE" && paymentProvider) {
      const proceed = window.confirm(
        `${workspaceName} has an active subscription.\n\n` +
          sharedNote +
          "Setting them to FREE here removes access but does NOT cancel their " +
          "subscription in Stripe - they would keep being charged. Cancel it in " +
          "Stripe instead, and the webhook will move them down automatically."
      );
      if (!proceed) return;
    } else if (memberCount > 1) {
      // A move between paid tiers on a shared workspace still needs the
      // "this is not one person" warning, which the branches above carry.
      const proceed = window.confirm(
        `Move ${workspaceName} to the ${next} plan?\n\n` + sharedNote.trim()
      );
      if (!proceed) return;
    }

    setBusy(true);
    try {
      await api.patch(`/api/admin/workspaces/${workspaceId}`, { plan: next });
      toast({
        title: `${workspaceName} moved to ${next}`,
        description: paymentProvider
          ? "Access changed here. Billing in Stripe is unchanged."
          : "No charge was made.",
        variant: "success",
      });
      onChanged?.();
    } catch (err) {
      toast({
        title: "Plan change refused",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Select
        value={plan}
        onChange={(event) => change(event.target.value)}
        disabled={busy}
        aria-label={`Plan for ${workspaceName}`}
        className={cn("w-auto", compact ? "h-7 min-w-[92px] px-1.5 text-2xs" : "min-w-[120px]")}
      >
        {ADMIN_PLANS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
      {busy && <Loader2 className="h-3 w-3 animate-spin text-subtle-foreground" />}
    </span>
  );
}
