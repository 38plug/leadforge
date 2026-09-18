"use client";

import Link from "next/link";
import {
  Users,
  Flame,
  Globe2,
  Send,
  Trophy,
  Radar,
  KanbanSquare,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AcquisitionChart, PipelineFunnelChart } from "@/components/dashboard/charts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeadStatusBadge, WebsiteStatusBadge } from "@/components/leads/badges";
import { ScoreRing } from "@/components/leads/opportunity-score";
import { SectionHeading } from "@/components/layout/page-header";
import { ErrorState, EmptyState, SkeletonCards, SkeletonRows } from "@/components/ui/state";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import { adaptLead } from "@/lib/adapters";
import type { ApiAnalytics, ApiLead, ApiTimeseries } from "@/types/api";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function OverviewPage() {
  const { user } = useAuth();
  const { data: leadsRaw, loading: leadsLoading, error: leadsError, refetch: refetchLeads } =
    useApi<ApiLead[]>("/api/leads");
  const { data: analytics, loading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } =
    useApi<ApiAnalytics>("/api/analytics");
  const { data: series, loading: seriesLoading, error: seriesError, refetch: refetchSeries } =
    useApi<ApiTimeseries>("/api/analytics/timeseries");

  const loading = leadsLoading || analyticsLoading || seriesLoading;
  const error = leadsError || analyticsError || seriesError;
  const firstName = (user?.full_name || user?.email || "").split(/[\s@]/)[0];

  const hero = (
    <section className="ambient-glow relative overflow-hidden rounded-xl">
      <div className="grid-bg relative rounded-xl border border-border bg-surface px-6 py-7">
        <p className="text-2xs font-medium uppercase tracking-[0.08em] text-primary">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </p>
        <h2 className="mt-2 max-w-xl text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">
          Your acquisition workspace is ready.
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Find local businesses without a decent web presence, see why each one is worth your time,
          and turn the best of them into conversations.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link href="/lead-finder">
              <Radar className="h-4 w-4" />
              Discover businesses
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/crm">
              <KanbanSquare className="h-4 w-4" />
              Open pipeline
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/campaigns">
              Create campaign
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {hero}
        <SkeletonCards count={5} />
        <SkeletonRows rows={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {hero}
        <Card>
          <ErrorState
            title="Your workspace data could not be loaded"
            message={error}
            onRetry={() => {
              refetchLeads();
              refetchAnalytics();
              refetchSeries();
            }}
          />
        </Card>
      </div>
    );
  }

  const leads = (leadsRaw ?? []).map(adaptLead);

  if (leads.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {hero}
        <Card>
          <EmptyState
            icon={Radar}
            title="No leads yet"
            description="Your next client could be one search away. Pick a city and an industry, and LeadForge will find businesses that need a better website."
            action={
              <Button asChild>
                <Link href="/lead-finder">Discover businesses</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const noWebsite = leads.filter((lead) => lead.websiteStatus === "NO_WEBSITE");
  const highOpportunity = leads.filter((lead) => lead.score.score >= 80);
  const outreachActive = leads.filter((lead) =>
    ["CONTACTED", "REPLIED", "INTERESTED", "MEETING", "PROPOSAL"].includes(lead.status)
  );
  const won = leads.filter((lead) => lead.status === "WON");

  const topOpportunities = [...leads].sort((a, b) => b.score.score - a.score.score).slice(0, 6);

  // Score distribution, computed from the leads actually loaded.
  const bands = [
    { label: "High", range: "80-100", count: highOpportunity.length, tone: "bg-primary" },
    {
      label: "Medium",
      range: "60-79",
      count: leads.filter((l) => l.score.score >= 60 && l.score.score < 80).length,
      tone: "bg-warning",
    },
    {
      label: "Low",
      range: "0-59",
      count: leads.filter((l) => l.score.score < 60).length,
      tone: "bg-border-strong",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {hero}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Total leads" value={leads.length} icon={Users} href="/leads" />
        <MetricCard
          label="High opportunity"
          value={highOpportunity.length}
          icon={Flame}
          href="/leads"
          accent
        />
        <MetricCard label="Needs a website" value={noWebsite.length} icon={Globe2} href="/leads" />
        <MetricCard label="Outreach active" value={outreachActive.length} icon={Send} href="/crm" />
        <MetricCard label="Won" value={won.length} icon={Trophy} href="/crm" />
      </div>

      {/* ---------------------------------------------------- AI opportunity brief */}
      {(noWebsite.length > 0 || highOpportunity.length > 0) && (
        <Card className="relative overflow-hidden">
          <span
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl"
            style={{ background: "hsl(var(--glow-strong) / 0.1)" }}
            aria-hidden="true"
          />
          <CardHeader className="relative">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              <CardTitle>Opportunity brief</CardTitle>
            </div>
            <CardDescription>
              Drawn from the leads in your workspace right now.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative flex flex-col gap-2.5">
            {noWebsite.length > 0 && (
              <Link
                href="/leads"
                className="surface surface-interactive flex items-center gap-3 rounded-lg p-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/12">
                  <Globe2 className="h-4 w-4 text-primary" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 text-[13px] leading-relaxed">
                  <strong className="font-semibold">{noWebsite.length}</strong>{" "}
                  {noWebsite.length === 1 ? "business has" : "businesses have"} no website detected — the
                  strongest signal in your list.
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-subtle-foreground" aria-hidden="true" />
              </Link>
            )}
            {highOpportunity.length > 0 && (
              <Link
                href="/crm"
                className="surface surface-interactive flex items-center gap-3 rounded-lg p-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background/60">
                  <Flame className="h-4 w-4 text-warning" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 text-[13px] leading-relaxed">
                  <strong className="font-semibold">{highOpportunity.length}</strong> scoring 80 or above
                  {outreachActive.length === 0 ? " and none contacted yet." : "."}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-subtle-foreground" aria-hidden="true" />
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* ------------------------------------------------- opportunity overview */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Opportunity overview</CardTitle>
            <CardDescription>How your saved leads score.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {bands.map((band) => {
                const pct = leads.length ? Math.round((band.count / leads.length) * 100) : 0;
                return (
                  <div key={band.label} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs font-medium">{band.label}</span>
                    <span className="w-12 shrink-0 text-2xs text-subtle-foreground">{band.range}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className={`block h-full rounded-full ${band.tone} transition-[width] duration-700 ease-out`}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="numeric w-16 shrink-0 text-right text-xs">
                      {band.count}
                      <span className="ml-1 text-subtle-foreground">{pct}%</span>
                    </span>
                  </div>
                );
              })}
            </div>
            {series?.acquisition && series.acquisition.length > 0 && (
              <div className="border-t border-border pt-4">
                <AcquisitionChart data={series.acquisition} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
            <CardDescription>Where your leads currently sit.</CardDescription>
          </CardHeader>
          <CardContent>
            {series?.funnel && series.funnel.length > 0 ? (
              <PipelineFunnelChart data={series.funnel} />
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Pipeline data appears once leads start moving between stages.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* --------------------------------------------------- recent opportunities */}
      <div>
        <SectionHeading
          title="Top opportunities"
          description="Your highest-scoring leads right now."
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href="/leads">
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        />
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-2xs text-subtle-foreground">
                  <th scope="col" className="px-4 py-2.5 font-medium">Business</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Location</th>
                  <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Category</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Website</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Opportunity</th>
                  <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {topOpportunities.map((lead) => (
                  <tr key={lead.id} className="row-hover border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="font-medium transition-colors hover:text-primary"
                      >
                        {lead.company}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {[lead.city, lead.country].filter(Boolean).join(", ")}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                      {lead.niche}
                    </td>
                    <td className="px-4 py-3">
                      <WebsiteStatusBadge status={lead.websiteStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <ScoreRing score={lead.score.score} size={34} />
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
