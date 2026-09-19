"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorState, SkeletonRows } from "@/components/ui/state";
import { useApi } from "@/lib/use-api";
import { PlanSelect } from "@/components/admin/plan-select";
import type { AdminWorkspace } from "@/types/api";

/**
 * Every workspace, with the plan it is on.
 *
 * Changing a plan here grants access without charging anyone - it is for
 * comped accounts, partnerships and support fixes. A customer who pays gets
 * their plan from the Stripe webhook instead, so this screen says which
 * subscriptions are actually backed by a payment provider and which were set
 * by hand.
 *
 * The control itself is PlanSelect, shared with the Accounts screen so both
 * carry the same warnings rather than one copy quietly losing them.
 */
export function AdminWorkspacesPanel() {
  const { data, loading, error, refetch } = useApi<AdminWorkspace[]>("/api/admin/workspaces");

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
                    <div className="flex flex-col gap-0.5">
                      <Badge variant="success" dot>
                        {workspace.subscription_status ?? "active"}
                      </Badge>
                      <span className="text-2xs text-subtle-foreground">
                        via {workspace.payment_provider}
                      </span>
                    </div>
                  ) : workspace.plan !== "FREE" ? (
                    // A paid plan with no provider behind it was granted by
                    // hand. Worth distinguishing: it will never renew, and
                    // nobody is being charged for it.
                    <div className="flex flex-col gap-0.5">
                      <Badge variant="warning" dot>Comped</Badge>
                      <span className="text-2xs text-subtle-foreground">no payment</span>
                    </div>
                  ) : (
                    <span className="text-2xs text-subtle-foreground">Free plan</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <PlanSelect
                    workspaceId={workspace.id}
                    workspaceName={workspace.name}
                    plan={workspace.plan}
                    memberCount={workspace.member_count}
                    paymentProvider={workspace.payment_provider}
                    onChanged={refetch}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
