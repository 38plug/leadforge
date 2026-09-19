"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorState, SkeletonRows } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useApi } from "@/lib/use-api";
import { api, ApiError } from "@/lib/api";
import type { AdminWorkspace } from "@/types/api";

const PLANS = ["FREE", "STARTER", "PRO", "AGENCY", "BUSINESS"];

/**
 * Every workspace, with the plan it is on.
 *
 * Changing a plan here grants access without charging anyone - it is for
 * comped accounts, partnerships and support fixes. A customer who pays gets
 * their plan from the Stripe webhook instead, so this screen says which
 * subscriptions are actually backed by a payment provider and which were set
 * by hand.
 */
export function AdminWorkspacesPanel() {
  const { toast } = useToast();
  const { data, loading, error, refetch } = useApi<AdminWorkspace[]>("/api/admin/workspaces");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function changePlan(workspace: AdminWorkspace, plan: string) {
    setBusyId(workspace.id);
    try {
      await api.patch(`/api/admin/workspaces/${workspace.id}`, { plan });
      toast({
        title: `${workspace.name} moved to ${plan}`,
        description: "No charge was made.",
        variant: "success",
      });
      refetch();
    } catch (err) {
      toast({
        title: "Plan change refused",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <Card className="p-4">
        <SkeletonRows rows={5} />
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <ErrorState title="Workspaces could not be loaded" message={error} onRetry={refetch} />
      </Card>
    );
  }

  const workspaces = data ?? [];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <CardTitle>Workspaces</CardTitle>
        <CardDescription>
          {workspaces.length} across the platform. Changing a plan here grants access without
          taking payment — use it for comped and partnership accounts.
        </CardDescription>
      </CardHeader>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="label-caps px-4 py-2.5">Workspace</th>
              <th scope="col" className="label-caps px-4 py-2.5">Members</th>
              <th scope="col" className="label-caps px-4 py-2.5">Leads</th>
              <th scope="col" className="label-caps px-4 py-2.5">Billing</th>
              <th scope="col" className="label-caps px-4 py-2.5">Plan</th>
            </tr>
          </thead>
          <tbody>
            {workspaces.map((workspace) => (
              <tr key={workspace.id} className="row-hover border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{workspace.name}</p>
                  <p className="text-2xs text-subtle-foreground">{workspace.slug}</p>
                </td>
                <td className="numeric px-4 py-3 text-xs">{workspace.member_count}</td>
                <td className="numeric px-4 py-3 text-xs">{workspace.lead_count.toLocaleString()}</td>
                <td className="px-4 py-3">
                  {workspace.payment_provider ? (
                    <Badge variant="success" dot>
                      {workspace.subscription_status ?? "active"}
                    </Badge>
                  ) : (
                    <span className="text-2xs text-subtle-foreground">Not paying</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Select
                      value={workspace.plan}
                      onChange={(event) => changePlan(workspace, event.target.value)}
                      disabled={busyId === workspace.id}
                      aria-label={`Plan for ${workspace.name}`}
                      className="w-auto min-w-[120px]"
                    >
                      {PLANS.map((plan) => (
                        <option key={plan} value={plan}>
                          {plan}
                        </option>
                      ))}
                    </Select>
                    {busyId === workspace.id && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-subtle-foreground" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
