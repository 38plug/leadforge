"use client";

import { useEffect, useState } from "react";
import { Plus, Pause, Play, Megaphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useApi } from "@/lib/use-api";
import { api, ApiError } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/utils";
import type { ApiCampaign, ApiCampaignRecipient, CampaignStatus } from "@/types/api";

const statusVariant: Record<CampaignStatus, "muted" | "default" | "success" | "warning" | "secondary"> = {
  DRAFT: "muted",
  SCHEDULED: "secondary",
  RUNNING: "default",
  PAUSED: "warning",
  COMPLETED: "success",
};

export default function CampaignsPage() {
  const { data: campaigns, loading, error, refetch } = useApi<ApiCampaign[]>("/api/campaigns");
  const { toast } = useToast();
  const [recipientCounts, setRecipientCounts] = useState<Record<string, ApiCampaignRecipient[]>>({});
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("Quick idea for {{company_name}}");
  const [sender, setSender] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!campaigns) return;
    Promise.all(
      campaigns.map((c) =>
        api.get<ApiCampaignRecipient[]>(`/api/campaigns/${c.id}/recipients`).then((r) => [c.id, r] as const)
      )
    ).then((entries) => setRecipientCounts(Object.fromEntries(entries)));
  }, [campaigns]);

  async function handlePause(id: string, next: CampaignStatus) {
    try {
      await api.patch(`/api/campaigns/${id}/status`, { status: next });
      refetch();
    } catch (err) {
      toast({ title: "Couldn't update campaign", description: err instanceof ApiError ? err.message : undefined, variant: "error" });
    }
  }

  async function handleCreate() {
    if (!name.trim() || !subject.trim() || !sender.trim()) return;
    setCreating(true);
    try {
      await api.post("/api/campaigns", { name, subject, sender });
      setShowForm(false);
      setName("");
      setSender("");
      refetch();
      toast({ title: "Campaign created", variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't create campaign", description: err instanceof ApiError ? err.message : undefined, variant: "error" });
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <LoadingState label="Loading campaigns..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Outreach sequences with compliant sending controls.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}><Plus className="h-4 w-4" /> New Campaign</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Campaign</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Berlin Cafes" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Sender email</label>
              <Input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="you@youragency.com" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Subject</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <Button onClick={handleCreate} disabled={creating}>Create</Button>
          </CardContent>
        </Card>
      )}

      {(!campaigns || campaigns.length === 0) && (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create your first outreach campaign to start sending compliant, tracked emails to your leads."
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {campaigns?.map((c) => {
          const recipients = recipientCounts[c.id] ?? [];
          const sent = recipients.filter((r) => r.status === "SENT" || r.status === "OPENED" || r.status === "REPLIED").length;
          const opened = recipients.filter((r) => r.opened_at).length;
          const replied = recipients.filter((r) => r.replied_at).length;
          const bounced = recipients.filter((r) => r.bounced_at).length;
          const unsubscribed = recipients.filter((r) => r.unsubscribed_at).length;
          const openRate = sent ? (opened / sent) * 100 : 0;
          const replyRate = sent ? (replied / sent) * 100 : 0;

          return (
            <Card key={c.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>{c.name}</CardTitle>
                    <Badge variant={statusVariant[c.status]}>{c.status}</Badge>
                  </div>
                  <CardDescription>{c.description || "No description"}</CardDescription>
                </div>
                {c.status === "RUNNING" && (
                  <Button size="sm" variant="outline" onClick={() => handlePause(c.id, "PAUSED")}>
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </Button>
                )}
                {c.status === "PAUSED" && (
                  <Button size="sm" variant="outline" onClick={() => handlePause(c.id, "RUNNING")}>
                    <Play className="h-3.5 w-3.5" /> Resume
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <p className="mb-3 truncate text-xs text-muted-foreground">Subject: &ldquo;{c.subject}&rdquo;</p>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <Metric label="Recipients" value={formatNumber(recipients.length)} />
                  <Metric label="Sent" value={formatNumber(sent)} />
                  <Metric label="Open Rate" value={formatPercent(openRate)} />
                  <Metric label="Reply Rate" value={formatPercent(replyRate)} />
                </div>
                <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
                  <span>{bounced} bounced</span>
                  <span>{unsubscribed} unsubscribed</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Follow-up Sequence (default)</CardTitle>
          <CardDescription>Applies to new campaigns unless customized. Stops automatically on reply, bounce, or unsubscribe.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {[
              { day: "Day 0", label: "Initial email" },
              { day: "Day 3", label: "Follow-up" },
              { day: "Day 7", label: "Second follow-up" },
              { day: "Day 14", label: "Final follow-up" },
            ].map((step) => (
              <div key={step.day} className="flex min-w-[140px] flex-1 flex-col gap-1 rounded-md border border-border p-3">
                <p className="text-xs font-semibold text-primary">{step.day}</p>
                <p className="text-xs text-muted-foreground">{step.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
