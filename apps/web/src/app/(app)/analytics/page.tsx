"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AcquisitionChart, OutreachChart, PipelineFunnelChart } from "@/components/dashboard/charts";
import { LoadingState, ErrorState } from "@/components/ui/state";
import { useApi } from "@/lib/use-api";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { ApiAnalytics, ApiTimeseries } from "@/types/api";

export default function AnalyticsPage() {
  const { data: analytics, loading, error, refetch } = useApi<ApiAnalytics>("/api/analytics");
  const { data: series, loading: seriesLoading, error: seriesError, refetch: refetchSeries } = useApi<ApiTimeseries>(
    "/api/analytics/timeseries?days=14"
  );

  const retry = () => {
    refetch();
    refetchSeries();
  };

  if (loading || seriesLoading) return <LoadingState label="Loading analytics..." />;
  if (error || seriesError || !analytics) return <ErrorState message={error ?? seriesError ?? "No data"} onRetry={retry} />;

  const byNiche = analytics.leads_by_niche.slice(0, 8);
  const byCountry = analytics.leads_by_country;
  const avgDeal = analytics.leads_won ? analytics.revenue / analytics.leads_won : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Full-funnel performance across leads, outreach, and revenue.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Leads Saved" value={formatNumber(analytics.leads_found)} />
        <Metric label="Won" value={formatNumber(analytics.leads_won)} />
        <Metric label="Avg Deal Value" value={formatCurrency(avgDeal)} />
        <Metric label="Revenue" value={formatCurrency(analytics.revenue)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Leads by Niche</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {byNiche.length === 0 && <p className="text-xs text-muted-foreground">No data yet.</p>}
            {byNiche.map((item) => (
              <BarRow key={item.name} label={item.name} value={item.value} max={byNiche[0].value} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Leads by Country</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {byCountry.length === 0 && <p className="text-xs text-muted-foreground">No data yet.</p>}
            {byCountry.map((item) => (
              <BarRow key={item.name} label={item.name} value={item.value} max={byCountry[0].value} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lead Acquisition</CardTitle>
            <CardDescription>Leads saved vs. deals won, last 14 days</CardDescription>
          </CardHeader>
          <CardContent><AcquisitionChart data={series?.acquisition ?? []} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Conversion Funnel</CardTitle></CardHeader>
          <CardContent><PipelineFunnelChart data={series?.funnel ?? []} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Campaign Performance</CardTitle></CardHeader>
        <CardContent><OutreachChart data={series?.outreach ?? []} /></CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 shrink-0 truncate text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right tabular-nums">{value}</span>
    </div>
  );
}
