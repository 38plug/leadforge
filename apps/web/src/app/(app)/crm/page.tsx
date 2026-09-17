"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ScorePill } from "@/components/leads/badges";
import { LoadingState, ErrorState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useApi } from "@/lib/use-api";
import { adaptLead } from "@/lib/adapters";
import { api, ApiError } from "@/lib/api";
import type { ApiLead } from "@/types/api";
import type { Lead, LeadStatus } from "@/types/lead";
import { formatCurrency } from "@/lib/utils";

const STAGES: { key: LeadStatus; label: string }[] = [
  { key: "NEW", label: "New" },
  { key: "RESEARCHED", label: "Researched" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "REPLIED", label: "Replied" },
  { key: "INTERESTED", label: "Interested" },
  { key: "MEETING", label: "Meeting" },
  { key: "PROPOSAL", label: "Proposal" },
  { key: "WON", label: "Won" },
  { key: "LOST", label: "Lost" },
];

export default function CrmPage() {
  const { data: leadsRaw, loading, error, refetch } = useApi<ApiLead[]>("/api/leads");
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    if (leadsRaw) setLeads(leadsRaw.map(adaptLead));
  }, [leadsRaw]);

  async function onDrop(stage: LeadStatus) {
    if (!dragId) return;
    const previous = leads;
    setLeads((prev) => prev.map((l) => (l.id === dragId ? { ...l, status: stage } : l)));
    const leadId = dragId;
    setDragId(null);
    try {
      await api.patch(`/api/leads/${leadId}`, { status: stage });
    } catch (err) {
      setLeads(previous);
      toast({ title: "Couldn't move lead", description: err instanceof ApiError ? err.message : "Please try again", variant: "error" });
    }
  }

  if (loading) return <LoadingState label="Loading pipeline..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">CRM</h1>
        <p className="text-sm text-muted-foreground">Drag leads across stages to track your pipeline.</p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.status === stage.key);
          const stageValue = stageLeads.reduce((sum, l) => sum + (l.estimatedValue ?? 0), 0);
          return (
            <div
              key={stage.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(stage.key)}
              className="flex w-72 shrink-0 flex-col gap-2 rounded-lg border border-border bg-card/40 p-2"
            >
              <div className="flex items-center justify-between px-1 py-1">
                <div>
                  <p className="text-xs font-semibold">{stage.label}</p>
                  <p className="text-[11px] text-muted-foreground">{stageLeads.length} leads · {formatCurrency(stageValue)}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {stageLeads.map((lead) => (
                  <Card
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragId(lead.id)}
                    className="cursor-grab p-3 hover:border-primary/50 active:cursor-grabbing"
                  >
                    <Link href={`/leads/${lead.id}`} className="flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{lead.company}</p>
                        <ScorePill score={lead.score.score} />
                      </div>
                      <p className="text-[11px] text-muted-foreground">{lead.niche} · {lead.city}</p>
                      {lead.estimatedValue && (
                        <p className="text-xs font-medium text-success">{formatCurrency(lead.estimatedValue)}</p>
                      )}
                    </Link>
                  </Card>
                ))}
                {stageLeads.length === 0 && (
                  <div className="rounded-md border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">
                    Drop a lead here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground">
          Tip: click a card to open the full lead detail page, notes, tasks, and activity history.
        </CardContent>
      </Card>
    </div>
  );
}
