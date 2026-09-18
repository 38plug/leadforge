"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { initials } from "@/lib/utils";
import { useApi } from "@/lib/use-api";
import { api, ApiError } from "@/lib/api";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { ApiUsage, ApiWorkspaceMember } from "@/types/api";
import { Trash2, AlertTriangle, Compass } from "lucide-react";
import { ProductTour } from "@/components/onboarding/product-tour";
import { EmailSettings } from "@/components/settings/email-settings";

type Tab = "general" | "email" | "billing" | "team";

const PLANS = [
  { key: "FREE", name: "Free", price: "$0", searches: "50/mo", ai: "10/mo", seats: 1 },
  { key: "STARTER", name: "Starter", price: "$29", searches: "500/mo", ai: "100/mo", seats: 2 },
  { key: "PRO", name: "Pro", price: "$79", searches: "2,000/mo", ai: "500/mo", seats: 5 },
  { key: "AGENCY", name: "Agency", price: "$199", searches: "10,000/mo", ai: "2,500/mo", seats: 15 },
  { key: "BUSINESS", name: "Business", price: "Custom", searches: "Unlimited", ai: "Unlimited", seats: -1 },
];

const TABS: Tab[] = ["general", "email", "billing", "team"];

export default function SettingsPage() {
  // Deep-linkable, so the sidebar's usage meter can open straight to Billing
  // rather than dropping the user on General to hunt for it.
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(
    requested && TABS.includes(requested) ? requested : "general"
  );
  const [replayingTour, setReplayingTour] = useState(false);
  const { workspace, user } = useAuth();
  const { toast } = useToast();

  const [workspaceName, setWorkspaceName] = useState(workspace?.name ?? "");
  useEffect(() => setWorkspaceName(workspace?.name ?? ""), [workspace]);

  const { data: usage, loading: usageLoading, error: usageError, refetch: refetchUsage } = useApi<ApiUsage>(
    tab === "billing" ? "/api/workspace/usage" : null
  );
  const { data: members, loading: membersLoading, error: membersError, refetch: refetchMembers } = useApi<ApiWorkspaceMember[]>(
    tab === "team" ? "/api/workspace/members" : null
  );

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);

  async function handleSaveWorkspace() {
    setSavingWorkspace(true);
    try {
      await api.patch("/api/workspace", { name: workspaceName });
      toast({ title: "Workspace updated", variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't save", description: err instanceof ApiError ? err.message : undefined, variant: "error" });
    } finally {
      setSavingWorkspace(false);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await api.post("/api/workspace/members/invite", { email: inviteEmail.trim() });
      setInviteEmail("");
      refetchMembers();
      toast({ title: "Member added", variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't invite member", description: err instanceof ApiError ? err.message : undefined, variant: "error" });
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(memberId: string) {
    try {
      await api.delete(`/api/workspace/members/${memberId}`);
      refetchMembers();
    } catch (err) {
      toast({ title: "Couldn't remove member", description: err instanceof ApiError ? err.message : undefined, variant: "error" });
    }
  }

  async function handleClearLeads() {
    setClearing(true);
    try {
      await api.delete("/api/leads");
      setClearConfirmText("");
      toast({ title: "All leads deleted", description: "Your workspace is now empty — run a new search to populate it.", variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't clear leads", description: err instanceof ApiError ? err.message : undefined, variant: "error" });
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your workspace, billing, and team.</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {([
          { key: "general", label: "General" },
          { key: "email", label: "Email" },
          { key: "billing", label: "Billing" },
          { key: "team", label: "Team Management" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>General information about your workspace</CardDescription>
          </CardHeader>
          <CardContent className="flex max-w-md flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Workspace name</label>
              <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
            </div>
            <Button className="w-fit" onClick={handleSaveWorkspace} disabled={savingWorkspace}>
              Save Changes
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "email" && <EmailSettings />}

      {tab === "general" && (
        <Card>
          <CardHeader>
            <CardTitle>Product Tour</CardTitle>
            <CardDescription>
              A walkthrough of every section of LeadForge. Replay it whenever you like.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-fit gap-2" onClick={() => setReplayingTour(true)}>
              <Compass className="h-4 w-4" />
              Replay tour
            </Button>
          </CardContent>
        </Card>
      )}

      {replayingTour && (
        <ProductTour
          onClose={(neverShowAgain) => {
            setReplayingTour(false);
            if (!user) return;
            try {
              const key = `leadforge.tour-dismissed.${user.id}`;
              if (neverShowAgain) localStorage.setItem(key, "1");
              else localStorage.removeItem(key);
            } catch {
              // Storage unavailable — the preference just isn't remembered.
            }
          }}
        />
      )}

      {tab === "general" && (
        <Card className="border-destructive/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <CardTitle>Danger Zone</CardTitle>
            </div>
            <CardDescription>These actions are permanent and cannot be undone.</CardDescription>
          </CardHeader>
          <CardContent className="flex max-w-md flex-col gap-3">
            <div>
              <p className="text-sm font-medium">Clear all leads</p>
              <p className="text-xs text-muted-foreground">
                Permanently deletes every lead, company, note, task, and activity in this workspace — useful for
                wiping out test/mock-provider data before connecting a real business data source.
              </p>
            </div>
            <Input
              placeholder='Type "DELETE" to confirm'
              value={clearConfirmText}
              onChange={(e) => setClearConfirmText(e.target.value)}
            />
            <Button
              variant="destructive"
              className="w-fit"
              disabled={clearConfirmText !== "DELETE" || clearing}
              onClick={handleClearLeads}
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear all leads
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "billing" && (
        <div className="flex flex-col gap-4">
          {usageLoading && <LoadingState label="Loading usage..." />}
          {usageError && <ErrorState message={usageError} onRetry={refetchUsage} />}
          {usage && (
            <Card>
              <CardHeader>
                <CardTitle>Usage This Month</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Usage label="Lead Searches" value={usage.lead_searches.toString()} limit="—" />
                <Usage label="AI Analyses" value={usage.ai_analyses.toString()} limit="—" />
                <Usage label="Emails Sent" value={usage.emails_sent.toString()} limit="—" />
                <Usage label="Team Members" value={usage.team_members.toString()} limit="—" />
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {PLANS.map((plan) => {
              const isCurrent = workspace?.plan === plan.key;
              return (
                <Card key={plan.key} className={isCurrent ? "border-primary" : undefined}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{plan.name}</CardTitle>
                      {isCurrent && <Badge>Current</Badge>}
                    </div>
                    <p className="text-xl font-semibold">{plan.price}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                    <p>{plan.searches} lead searches</p>
                    <p>{plan.ai} AI analyses</p>
                    <p>{plan.seats === -1 ? "Unlimited" : plan.seats} seats</p>
                    <Button variant={isCurrent ? "outline" : "default"} size="sm" className="mt-2" disabled={isCurrent}>
                      {isCurrent ? "Current Plan" : "Upgrade"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Payment processing is not yet connected. This screen reflects the billing architecture — plug in Stripe (or another provider) via <code className="rounded bg-muted px-1 py-0.5 font-mono">apps/api/app/services/billing.py</code>.
          </p>
        </div>
      )}

      {tab === "team" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Manage roles and access for your workspace</CardDescription>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="teammate@studio.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-9 w-56"
              />
              <Button size="sm" onClick={handleInvite} disabled={inviting}>Invite Member</Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border p-0">
            {membersLoading && <LoadingState label="Loading team..." />}
            {membersError && <ErrorState message={membersError} onRetry={refetchMembers} />}
            {members?.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {initials(member.full_name || member.email)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.full_name || member.email}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={member.role === "OWNER" ? "default" : "secondary"}>{member.role}</Badge>
                  {member.role !== "OWNER" && (
                    <Button size="icon" variant="ghost" onClick={() => handleRemove(member.id)} aria-label="Remove member">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Usage({ label, value, limit }: { label: string; value: string; limit: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value} <span className="text-xs font-normal text-muted-foreground">/ {limit}</span></p>
    </div>
  );
}
