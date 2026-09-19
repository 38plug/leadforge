"use client";

import { Users, Building2, Database, Ticket, CreditCard, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ErrorState, SkeletonCards } from "@/components/ui/state";
import { useApi } from "@/lib/use-api";
import type { AdminOverview } from "@/types/api";

/**
 * Installation-wide counts.
 *
 * The revenue panel says plainly when no payment processor is connected.
 * Showing a zero there would be indistinguishable from "nobody has paid yet",
 * and the two call for completely different actions.
 */
export function AdminOverviewPanel() {
  const { data, loading, error, refetch } = useApi<AdminOverview>("/api/admin/overview");

  if (loading) return <SkeletonCards count={6} />;
  if (error) {
    return (
      <Card>
        <ErrorState title="Platform data could not be loaded" message={error} onRetry={refetch} />
      </Card>
    );
  }
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Accounts" value={data.total_users} icon={Users} />
        <MetricCard label="Active" value={data.active_users} icon={UserCheck} />
        <MetricCard label="Workspaces" value={data.total_workspaces} icon={Building2} />
        <MetricCard label="Leads" value={data.total_leads} icon={Database} />
        <MetricCard label="Businesses" value={data.total_companies} icon={Database} />
        <MetricCard label="Active coupons" value={data.active_coupons} icon={Ticket} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-subtle-foreground" aria-hidden="true" />
            <CardTitle>Revenue</CardTitle>
          </div>
          <CardDescription>Paid subscriptions across the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.payment_provider_connected ? (
            <p className="numeric text-2xl font-semibold">
              {data.paying_subscriptions}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                paying {data.paying_subscriptions === 1 ? "subscription" : "subscriptions"}
              </span>
            </p>
          ) : (
            <div className="rounded-lg border border-border bg-background/40 p-4">
              <p className="text-[13px] font-medium">No payments have been taken yet</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Either no one has subscribed, or Stripe credentials are not set on the server. This
                panel will show real figures once the first subscription is paid — nothing here is
                estimated.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
