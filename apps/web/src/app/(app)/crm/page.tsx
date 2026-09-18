"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Radar, Globe2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { WebsiteStatusBadge } from "@/components/leads/badges";
import { ScoreRing } from "@/components/leads/opportunity-score";
import { ErrorState, EmptyState, SkeletonRows } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useApi } from "@/lib/use-api";
import { adaptLead } from "@/lib/adapters";
import { api, ApiError } from "@/lib/api";
import type { ApiLead } from "@/types/api";
import type { Lead, LeadStatus } from "@/types/lead";
import { formatCurrency, cn } from "@/lib/utils";

/**
 * Stage order is the deal's life, so the board reads left to right as
 * progress. Won and Lost are terminal and tinted accordingly - everything
 * between them is neutral, because colouring each stage differently turns the
 * board into a rainbow and hides where work is actually stuck.
 */
const STAGES: { key: LeadStatus; label: string; tone?: "won" | "lost" }[] = [
  { key: "NEW", label: "New" },
  { key: "RESEARCHED", label: "Researched" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "REPLIED", label: "Replied" },
  { key: "INTERESTED", label: "Interested" },
  { key: "MEETING", label: "Meeting" },
  { key: "PROPOSAL", label: "Proposal" },
  { key: "WON", label: "Won", tone: "won" },
  { key: "LOST", label: "Lost", tone: "lost" },
];

export default function PipelinePage() {
  const { data: leadsRaw, loading, error, refetch } = useApi<ApiLead[]>("/api/leads");
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<LeadStatus | null>(null);

  useEffect(() => {
    if (leadsRaw) setLeads(leadsRaw.map(adaptLead));
  }, [leadsRaw]);

  /**
   * Optimistic: the card moves immediately and is put back if the API
   * rejects it. Waiting for the round trip before moving makes dragging feel
   * broken, and silently leaving it moved would misreport the pipeline.
   */
  async function moveLead(leadId: string, stage: LeadStatus) {
    const previous = leads;
    setLeads((current) => current.map((l) => (l.id === leadId ? { ...l, status: stage } : l)));
    try {
      await api.patch(`/api/leads/${leadId}`, { status: stage });
    } catch (err) {
      setLeads(previous);
      toast({
        title: "Couldn't move that lead",
        description: err instanceof ApiError ? err.message : "Please try again",
        variant: "error",
      });
    }
  }

  function onDrop(stage: LeadStatus) {
    setOverStage(null);
    if (!dragId) return;
    const id = dragId;
    setDragId(null);
    void moveLead(id, stage);
  }

  const header = (
    <PageHeader
      title="Pipeline"
      description="Drag a lead between stages to move the deal forward."
      actions={
        <Button asChild variant="secondary">
          <Link href="/lead-finder">
            <Radar className="h-4 w-4" />
            Discover more
          </Link>
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-3">
              <SkeletonRows rows={3} />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Card>
          <ErrorState title="Your pipeline could not be loaded" message={error} onRetry={refetch} />
        </Card>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Card>
          <EmptyState
            icon={Radar}
            title="Nothing in the pipeline yet"
            description="Saved leads land in New, and you move them along as conversations progress."
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

  return (
    <div className="flex flex-col gap-6">
      {header}

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((lead) => lead.status === stage.key);
          const stageValue = stageLeads.reduce((sum, lead) => sum + (lead.estimatedValue ?? 0), 0);
          const isOver = overStage === stage.key;

          return (
            <section
              key={stage.key}
              onDragOver={(event) => {
                event.preventDefault();
                setOverStage(stage.key);
              }}
              onDragLeave={() => setOverStage((current) => (current === stage.key ? null : current))}
              onDrop={() => onDrop(stage.key)}
              aria-label={`${stage.label}, ${stageLeads.length} leads`}
              className={cn(
                "flex w-[272px] shrink-0 flex-col rounded-xl border bg-surface transition-colors",
                isOver ? "border-primary/50 bg-primary/[0.06]" : "border-border"
              )}
            >
              <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      stage.tone === "won" && "bg-success",
                      stage.tone === "lost" && "bg-border-strong",
                      !stage.tone && "bg-primary/60"
                    )}
                    aria-hidden="true"
                  />
                  <h3 className="text-xs font-semibold">{stage.label}</h3>
                  <span className="numeric rounded-sm bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
                    {stageLeads.length}
                  </span>
                </div>
                {stageValue > 0 && (
                  <span className="numeric text-2xs text-subtle-foreground">
                    {formatCurrency(stageValue)}
                  </span>
                )}
              </header>

              <div className="flex min-h-[120px] flex-col gap-2 p-2">
                {stageLeads.map((lead) => (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragId(lead.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStage(null);
                    }}
                    className={cn(
                      "surface surface-interactive cursor-grab rounded-lg p-2.5 active:cursor-grabbing",
                      dragId === lead.id && "opacity-50"
                    )}
                  >
                    <Link href={`/leads/${lead.id}`} className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug">
                          {lead.company}
                        </p>
                        <ScoreRing score={lead.score.score} size={32} />
                      </div>
                      <p className="truncate text-2xs text-subtle-foreground">
                        {[lead.niche, lead.city].filter(Boolean).join(" · ")}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <WebsiteStatusBadge status={lead.websiteStatus} />
                        {lead.estimatedValue ? (
                          <span className="numeric text-2xs font-medium text-success">
                            {formatCurrency(lead.estimatedValue)}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </article>
                ))}

                {stageLeads.length === 0 && (
                  <div
                    className={cn(
                      "flex flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-6 text-center text-2xs transition-colors",
                      isOver
                        ? "border-primary/50 text-primary"
                        : "border-border text-subtle-foreground"
                    )}
                  >
                    {isOver ? "Release to move here" : "Drop a lead here"}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="flex items-center gap-2 text-2xs text-subtle-foreground">
        <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
        Open any card for the full lead, its notes, tasks and activity history.
      </p>
    </div>
  );
}
