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
import { AcquisitionChart, PipelineFunnelChart } from "@/components/dashboard/charts";
import { Button } from "@/components/ui/button";
import { LeadStatusBadge, WebsiteStatusBadge } from "@/components/leads/badges";
import { ScoreRing } from "@/components/leads/opportunity-score";
import { ErrorState, EmptyState, SkeletonCards, SkeletonRows } from "@/components/ui/state";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import { adaptLead } from "@/lib/adapters";
import type { ApiAnalytics, ApiLead, ApiTimeseries } from "@/types/api";
import {
  InstrumentPanel,
  MetricInstrument,
  StatusLine,
  SectionIndex,
} from "@/components/layout/app-instruments";

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

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonCards count={4} />
        <SkeletonRows rows={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <InstrumentPanel>
          <ErrorState
            title="Your workspace data could not be loaded"
            message={error}
            onRetry={() => {
              refetchLeads();
              refetchAnalytics();
              refetchSeries();
            }}
          />
        </InstrumentPanel>
      </div>
    );
  }

  const leads = (leadsRaw ?? []).map(adaptLead);

  if (leads.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="dash-enter">
          <h1 className="text-[clamp(1.8rem,4vw,2.8rem)] font-bold leading-[0.92] tracking-[-0.03em] text-white">
            {greeting()}
            {firstName ? <>, <span className="text-gradient-brand">{firstName}</span></> : ""}
          </h1>
          <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-white/35">
            Your acquisition workspace is ready. Find local businesses without a decent web presence,
            see why each one is worth your time, and turn the best of them into conversations.
          </p>
        </div>

        <InstrumentPanel className="dash-enter dash-enter-delay-1">
          <EmptyState
            icon={Radar}
            title="No leads yet"
            description="Your next client could be one search away. Pick a city and an industry."
            action={
              <Button asChild>
                <Link href="/lead-finder">Discover businesses</Link>
              </Button>
            }
          />
        </InstrumentPanel>
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

  const bands = [
    { label: "High", range: "80-100", count: highOpportunity.length, color: "hsl(82 100% 61%)" },
    { label: "Medium", range: "60-79", count: leads.filter((l) => l.score.score >= 60 && l.score.score < 80).length, color: "hsl(38 84% 56%)" },
    { label: "Low", range: "0-59", count: leads.filter((l) => l.score.score < 60).length, color: "hsl(0 0% 100% / 0.15)" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Header ---- */}
      <div className="dash-enter">
        <h1 className="text-[clamp(1.8rem,4vw,2.8rem)] font-bold leading-[0.92] tracking-[-0.03em] text-white">
          {greeting()}
          {firstName ? <>, <span className="text-gradient-brand">{firstName}</span></> : ""}
        </h1>
        <p className="mt-2 max-w-lg text-[12px] leading-relaxed text-white/30">
          Your acquisition workspace is ready. Find businesses, score opportunities, close deals.
        </p>
      </div>

      {/* ---- Status strip ---- */}
      <div className="dash-enter dash-enter-delay-1">
        <StatusLine
          items={[
            { label: "SYSTEM ACTIVE", active: true },
            { label: "MARKET SCAN IDLE", active: false },
            { label: "OUTREACH READY", active: outreachActive.length > 0 },
          ]}
        />
      </div>

      {/* ---- Metrics ---- */}
      <div className="dash-enter dash-enter-delay-2 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Link href="/leads" className="metric-box">
          <MetricInstrument value={leads.length} label="TOTAL LEADS" />
        </Link>
        <Link href="/leads" className="metric-box metric-box--highlight">
          <MetricInstrument value={highOpportunity.length} label="HIGH OPPORTUNITY" />
        </Link>
        <Link href="/leads" className="metric-box">
          <MetricInstrument value={noWebsite.length} label="NEEDS WEBSITE" />
        </Link>
        <Link href="/crm" className="metric-box">
          <MetricInstrument value={outreachActive.length} label="OUTREACH ACTIVE" />
        </Link>
        <Link href="/crm" className="metric-box">
          <MetricInstrument value={won.length} label="WON" />
        </Link>
      </div>

      {/* ---- Opportunity brief ---- */}
      {(noWebsite.length > 0 || highOpportunity.length > 0) && (
        <InstrumentPanel className="dash-enter dash-enter-delay-3">
          <SectionIndex number="01" title="OPPORTUNITY BRIEF" />
          <div className="flex flex-col gap-2 p-4">
            {noWebsite.length > 0 && (
              <Link
                href="/leads"
                className="flex items-center gap-3 rounded-md border border-white/[0.04] bg-white/[0.015] p-3 transition-all duration-200 hover:border-white/[0.08] hover:bg-white/[0.03]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-primary/15 bg-primary/[0.06]">
                  <Globe2 className="h-3.5 w-3.5 text-primary" />
                </span>
                <span className="min-w-0 flex-1 text-[12px] leading-relaxed text-white/50">
                  <strong className="font-semibold text-white/70">{noWebsite.length}</strong>{" "}
                  {noWebsite.length === 1 ? "business has" : "businesses have"} no website — the
                  strongest signal in your list.
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/20" />
              </Link>
            )}
            {highOpportunity.length > 0 && (
              <Link
                href="/crm"
                className="flex items-center gap-3 rounded-md border border-white/[0.04] bg-white/[0.015] p-3 transition-all duration-200 hover:border-white/[0.08] hover:bg-white/[0.03]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/[0.06] bg-white/[0.03]">
                  <Flame className="h-3.5 w-3.5 text-amber-400/70" />
                </span>
                <span className="min-w-0 flex-1 text-[12px] leading-relaxed text-white/50">
                  <strong className="font-semibold text-white/70">{highOpportunity.length}</strong> scoring 80 or above
                  {outreachActive.length === 0 ? " and none contacted yet." : "."}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/20" />
              </Link>
            )}
          </div>
        </InstrumentPanel>
      )}

      {/* ---- Charts row ---- */}
      <div className="dash-enter dash-enter-delay-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <InstrumentPanel className="xl:col-span-2">
          <SectionIndex number="02" title="OPPORTUNITY OVERVIEW" right={`${leads.length} LEADS`} />
          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-3">
              {bands.map((band) => {
                const pct = leads.length ? Math.round((band.count / leads.length) * 100) : 0;
                return (
                  <div key={band.label} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-[11px] font-medium text-white/50">{band.label}</span>
                    <span className="w-12 shrink-0 text-[10px] text-white/20">{band.range}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <span
                        className="block h-full rounded-full transition-[width] duration-700 ease-out"
                        style={{ width: `${pct}%`, background: band.color }}
                      />
                    </span>
                    <span className="w-16 shrink-0 text-right text-[11px] font-variant-numeric:tabular-nums text-white/40">
                      {band.count} <span className="text-white/15">{pct}%</span>
                    </span>
                  </div>
                );
              })}
            </div>
            {series?.acquisition && series.acquisition.length > 0 && (
              <div className="border-t border-white/[0.04] pt-4">
                <AcquisitionChart data={series.acquisition} />
              </div>
            )}
          </div>
        </InstrumentPanel>

        <InstrumentPanel>
          <SectionIndex number="03" title="PIPELINE" />
          <div className="p-4">
            {series?.funnel && series.funnel.length > 0 ? (
              <PipelineFunnelChart data={series.funnel} />
            ) : (
              <p className="py-8 text-center text-[11px] text-white/20">
                Pipeline data appears once leads start moving between stages.
              </p>
            )}
          </div>
        </InstrumentPanel>
      </div>

      {/* ---- Top opportunities table ---- */}
      <div className="dash-enter dash-enter-delay-5">
        <InstrumentPanel>
          <SectionIndex number="04" title="TOP OPPORTUNITIES" right={`${topOpportunities.length} SHOWN`} />
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Business</th>
                  <th scope="col">Location</th>
                  <th scope="col" className="hidden md:table-cell">Category</th>
                  <th scope="col">Website</th>
                  <th scope="col">Score</th>
                  <th scope="col" className="hidden sm:table-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {topOpportunities.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <Link
                        href={`/leads/${lead.id}`}
                        className="font-medium text-white/70 transition-colors hover:text-primary"
                      >
                        {lead.company}
                      </Link>
                    </td>
                    <td className="text-white/35">
                      {[lead.city, lead.country].filter(Boolean).join(", ")}
                    </td>
                    <td className="hidden text-white/35 md:table-cell">{lead.niche}</td>
                    <td>
                      <WebsiteStatusBadge status={lead.websiteStatus} />
                    </td>
                    <td>
                      <ScoreRing score={lead.score.score} size={30} />
                    </td>
                    <td className="hidden sm:table-cell">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </InstrumentPanel>
      </div>
    </div>
  );
}
