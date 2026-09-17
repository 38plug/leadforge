"use client";

import { Users, PhoneCall, Flame, Trophy, Target, Wallet, UserPlus, CalendarCheck, LayoutDashboard } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { AcquisitionChart, OutreachChart, PipelineFunnelChart } from "@/components/dashboard/charts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeadStatusBadge, ScorePill, WebsiteStatusBadge } from "@/components/leads/badges";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/state";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useApi } from "@/lib/use-api";
import { adaptLead } from "@/lib/adapters";
import type { ApiAnalytics, ApiLead, ApiTimeseries } from "@/types/api";
import Link from "next/link";

export default function DashboardPage() {
  const { data: leadsRaw, loading: leadsLoading, error: leadsError, refetch: refetchLeads } = useApi<ApiLead[]>("/api/leads");
  const { data: analytics, loading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useApi<ApiAnalytics>("/api/analytics");
  const { data: series, loading: seriesLoading, error: seriesError, refetch: refetchSeries } = useApi<ApiTimeseries>("/api/analytics/timeseries");

  const loading = leadsLoading || analyticsLoading || seriesLoading;
  const error = leadsError || analyticsError || seriesError;

  if (loading) {
    return <LoadingState label="Loading your dashboard..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          refetchLeads();
          refetchAnalytics();
          refetchSeries();
        }}
      />
    );
  }

  const leads = (leadsRaw ?? []).map(adaptLead);

  if (leads.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your client-acquisition command center — here&apos;s what&apos;s moving today.
          </p>
        </div>
        <EmptyState
          icon={LayoutDashboard}
          title="No leads yet"
          description="Run your first search in Lead Finder to start populating your dashboard."
          action={
            <Link href="/lead-finder">
              <Button className="mt-2">Find New Leads</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const topOpportunities = [...leads].sort((a, b) => b.score.score - a.score.score).slice(0, 6);
  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);
  const followUps = leads.filter((l) => l.followUpDate).slice(0, 5);

  const contacted = analytics?.leads_contacted ?? 0;
  const won = analytics?.leads_won ?? 0;
  const newLeads = leads.filter((l) => l.status === "NEW").length;
  const interested = leads.filter((l) => l.status === "INTERESTED").length;
  const meetings = leads.filter((l) => l.status === "MEETING").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your client-acquisition command center — here&apos;s what&apos;s moving today.
          </p>
        </div>
        <Link href="/lead-finder">
          <Button className="sheen glow-btn">Find New Leads</Button>
        </Link>
      </div>

      <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <StatCard
          label="Leads Found"
          value={formatNumber(analytics?.leads_found ?? leads.length)}
          numericValue={analytics?.leads_found ?? leads.length}
          format={formatNumber}
          icon={Users}
        />
        <StatCard label="New Leads" value={formatNumber(newLeads)} numericValue={newLeads} format={formatNumber} icon={UserPlus} />
        <StatCard label="Contacted" value={formatNumber(contacted)} numericValue={contacted} format={formatNumber} icon={PhoneCall} />
        <StatCard label="Interested" value={formatNumber(interested)} numericValue={interested} format={formatNumber} icon={Flame} />
        <StatCard label="Meetings" value={formatNumber(meetings)} numericValue={meetings} format={formatNumber} icon={CalendarCheck} />
        <StatCard label="Won" value={formatNumber(won)} numericValue={won} format={formatNumber} icon={Trophy} />
        <StatCard
          label="Conversion Rate"
          value={`${(analytics?.conversion_rate ?? 0).toFixed(1)}%`}
          numericValue={analytics?.conversion_rate ?? 0}
          format={(n) => `${n.toFixed(1)}%`}
          icon={Target}
        />
        <StatCard
          label="Pipeline Value"
          value={formatCurrency(analytics?.pipeline_value ?? 0)}
          numericValue={analytics?.pipeline_value ?? 0}
          format={formatCurrency}
          icon={Wallet}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lead Acquisition</CardTitle>
            <CardDescription>Leads saved vs. deals won, last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <AcquisitionChart data={series?.acquisition ?? []} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Funnel</CardTitle>
            <CardDescription>End-to-end conversion</CardDescription>
          </CardHeader>
          <CardContent>
            <PipelineFunnelChart data={series?.funnel ?? []} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Outreach Activity</CardTitle>
            <CardDescription>Emails sent vs. replies received</CardDescription>
          </CardHeader>
          <CardContent>
            <OutreachChart data={series?.outreach ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Follow-up Reminders</CardTitle>
            <CardDescription>Due today or overdue</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {followUps.length === 0 && <p className="text-xs text-muted-foreground">No follow-ups due.</p>}
            {followUps.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{lead.company}</p>
                  <p className="text-xs text-muted-foreground">{lead.niche} · {lead.city}</p>
                </div>
                <LeadStatusBadge status={lead.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Opportunities</CardTitle>
          <CardDescription>Highest-scoring leads that need attention</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-y border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Company</th>
                  <th className="px-4 py-2 font-medium">Industry</th>
                  <th className="px-4 py-2 font-medium">Location</th>
                  <th className="px-4 py-2 font-medium">Website</th>
                  <th className="px-4 py-2 font-medium">Rating</th>
                  <th className="px-4 py-2 font-medium">Reviews</th>
                  <th className="px-4 py-2 font-medium">Score</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {topOpportunities.map((lead) => (
                  <tr key={lead.id} className="row-hover border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <Link href={`/leads/${lead.id}`} className="font-medium hover:text-primary">
                        {lead.company}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{lead.niche}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{lead.city}, {lead.country}</td>
                    <td className="px-4 py-2.5"><WebsiteStatusBadge status={lead.websiteStatus} /></td>
                    <td className="px-4 py-2.5 tabular-nums">{lead.rating ?? "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums">{lead.reviews ? formatNumber(lead.reviews) : "—"}</td>
                    <td className="px-4 py-2.5"><ScorePill score={lead.score.score} /></td>
                    <td className="px-4 py-2.5"><LeadStatusBadge status={lead.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Leads</CardTitle>
          <CardDescription>Most recently discovered or imported</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border p-0">
          {recentLeads.map((lead) => (
            <Link
              key={lead.id}
              href={`/leads/${lead.id}`}
              className="row-hover flex items-center justify-between px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{lead.company}</p>
                <p className="text-xs text-muted-foreground">
                  {lead.niche} · {lead.city}, {lead.country} · via {lead.source}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ScorePill score={lead.score.score} />
                <LeadStatusBadge status={lead.status} />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
