"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Phone, Mail, Globe, Instagram, Facebook, MapPin, Star,
  ArrowLeft, Sparkles, TrendingUp, Loader2, Plus, Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LeadStatusBadge, ScorePill, WebsiteStatusBadge } from "@/components/leads/badges";
import { LoadingState, ErrorState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { formatNumber } from "@/lib/utils";
import { useApi } from "@/lib/use-api";
import { adaptLead } from "@/lib/adapters";
import { api, ApiError } from "@/lib/api";
import type { AILeadAnalysis, ApiActivity, ApiLead, ApiNote, ApiTask } from "@/types/api";
import type { LeadStatus } from "@/types/lead";

const STATUS_OPTIONS: LeadStatus[] = [
  "NEW", "RESEARCHED", "CONTACTED", "REPLIED", "INTERESTED", "MEETING", "PROPOSAL", "WON", "LOST",
];

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { toast } = useToast();

  const { data: leadRaw, loading, error, refetch } = useApi<ApiLead>(`/api/leads/${id}`);
  const { data: activity, refetch: refetchActivity } = useApi<ApiActivity[]>(`/api/leads/${id}/activity`);
  const { data: notes, refetch: refetchNotes } = useApi<ApiNote[]>(`/api/leads/${id}/notes`);
  const { data: tasks, refetch: refetchTasks } = useApi<ApiTask[]>(`/api/leads/${id}/tasks`);

  const [analysis, setAnalysis] = useState<AILeadAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [taskText, setTaskText] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  if (loading) return <LoadingState label="Loading lead..." />;
  if (error || !leadRaw) return <ErrorState message={error ?? "Lead not found"} onRetry={refetch} />;

  const lead = adaptLead(leadRaw);
  const estimatedRange = analysis?.estimated_project_range ?? "Run AI analysis for an estimate";

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const result = await api.post<AILeadAnalysis>(`/api/leads/${id}/analyze`);
      setAnalysis(result);
      toast({ title: "Analysis complete", description: `Opportunity score: ${result.opportunity_score}/100`, variant: "success" });
    } catch (err) {
      toast({ title: "Analysis failed", description: err instanceof ApiError ? err.message : "Please try again", variant: "error" });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleStatusChange(status: LeadStatus) {
    setUpdatingStatus(true);
    try {
      await api.patch(`/api/leads/${id}`, { status });
      refetch();
      toast({ title: "Status updated", description: `Lead moved to ${status}`, variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't update status", description: err instanceof ApiError ? err.message : "Please try again", variant: "error" });
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleAddNote() {
    if (!noteText.trim()) return;
    try {
      await api.post(`/api/leads/${id}/notes`, { body: noteText.trim() });
      setNoteText("");
      refetchNotes();
      refetchActivity();
    } catch (err) {
      toast({ title: "Couldn't add note", description: err instanceof ApiError ? err.message : "Please try again", variant: "error" });
    }
  }

  async function handleAddTask() {
    if (!taskText.trim()) return;
    try {
      await api.post(`/api/leads/${id}/tasks`, { title: taskText.trim() });
      setTaskText("");
      refetchTasks();
      refetchActivity();
    } catch (err) {
      toast({ title: "Couldn't add task", description: err instanceof ApiError ? err.message : "Please try again", variant: "error" });
    }
  }

  async function handleToggleTask(taskId: string, completed: boolean) {
    try {
      await api.patch(`/api/leads/${id}/tasks/${taskId}`, { completed: !completed });
      refetchTasks();
    } catch {
      toast({ title: "Couldn't update task", variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/leads" className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to leads
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">{lead.company}</h1>
            <LeadStatusBadge status={lead.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {lead.niche} · {lead.city}, {lead.country}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={lead.status}
            disabled={updatingStatus}
            onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <ScorePill score={lead.score.score} />
          <span className="text-xs text-muted-foreground">Opportunity Score</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {lead.phone && (
          <a href={`tel:${lead.phone}`}>
            <Button variant="outline" size="sm"><Phone className="h-3.5 w-3.5" /> Call</Button>
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`}>
            <Button variant="outline" size="sm"><Mail className="h-3.5 w-3.5" /> Email</Button>
          </a>
        )}
        {lead.social.instagram && (
          <a href={`https://instagram.com/${lead.social.instagram}`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm"><Instagram className="h-3.5 w-3.5" /> Instagram</Button>
          </a>
        )}
        {lead.social.facebook && (
          <a href={`https://facebook.com/${lead.social.facebook}`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm"><Facebook className="h-3.5 w-3.5" /> Facebook</Button>
          </a>
        )}
        {lead.website && (
          <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm"><Globe className="h-3.5 w-3.5" /> Website</Button>
          </a>
        )}
        {lead.mapsUrl && (
          <a href={lead.mapsUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm"><MapPin className="h-3.5 w-3.5" /> Maps</Button>
          </a>
        )}
        <Button size="sm" onClick={handleAnalyze} disabled={analyzing}>
          {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {analyzing ? "Analyzing..." : "Analyze with AI"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="font-medium">{lead.niche}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rating</p>
                <p className="flex items-center gap-1 font-medium">
                  <Star className="h-3.5 w-3.5 fill-warning text-warning" /> {lead.rating ?? "—"} ({formatNumber(lead.reviews ?? 0)} reviews)
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="font-medium">{lead.address ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hours</p>
                <p className="font-medium">{lead.hours ?? "—"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="font-medium">{lead.description ?? "No description available."}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Website Analysis</CardTitle>
              <CardDescription>Automated check performed by the Website Provider</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <WebsiteStatusBadge status={lead.websiteStatus} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mobile responsive</span>
                <span>{lead.websiteStatus === "ACTIVE" ? "Yes" : "Unknown"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Performance</span>
                <span>{lead.websiteStatus === "ACTIVE" ? "Good" : "Not assessed"}</span>
              </div>
              <div className="rounded-md bg-accent/50 p-3 text-xs text-muted-foreground">
                {lead.websiteStatus === "NO_WEBSITE" &&
                  "No live website was found for this business. This is a strong signal — a new site is likely to be a straightforward sell."}
                {lead.websiteStatus === "OUTDATED" &&
                  "A website exists but appears outdated (old design patterns, missing mobile optimization, or stale content)."}
                {lead.websiteStatus === "INACCESSIBLE" &&
                  "The website did not respond successfully on the last check. It may be temporarily down — verify manually before pitching a rebuild."}
                {lead.websiteStatus === "ACTIVE" &&
                  "The website is active and reachable. Opportunity is likely limited to add-on services (SEO, redesign, booking systems)."}
                {lead.websiteStatus === "UNKNOWN" &&
                  "Website status could not be determined yet. Re-run detection or check manually."}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <CardTitle>AI Analysis</CardTitle>
              </div>
              <CardDescription>Generated by the AI Provider — validated against a structured schema</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              {!analysis && (
                <p className="text-xs text-muted-foreground">
                  Click &ldquo;Analyze with AI&rdquo; above to generate a fresh assessment of this lead.
                </p>
              )}
              {analysis && (
                <>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</p>
                    <p className="mt-1">{analysis.summary}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Strengths</p>
                      <ul className="mt-1 list-inside list-disc space-y-0.5">
                        {analysis.strengths.map((s) => <li key={s}>{s}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Weaknesses</p>
                      <ul className="mt-1 list-inside list-disc space-y-0.5">
                        {analysis.weaknesses.map((w) => <li key={w}>{w}</li>)}
                      </ul>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended pitch</p>
                    <p className="mt-1">{analysis.recommended_pitch}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended contact method</p>
                      <p className="mt-1">{analysis.recommended_contact_method}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estimated project value</p>
                      <p className="mt-1 font-medium">{estimatedRange}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Add a task..."
                  value={taskText}
                  onChange={(e) => setTaskText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                />
                <Button size="icon" onClick={handleAddTask} aria-label="Add task"><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-col gap-1.5">
                {(tasks ?? []).length === 0 && <p className="text-xs text-muted-foreground">No tasks yet.</p>}
                {(tasks ?? []).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleToggleTask(task.id, task.completed)}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${task.completed ? "border-primary bg-primary" : "border-input"}`}>
                      {task.completed && <Check className="h-3 w-3 text-primary-foreground" />}
                    </span>
                    <span className={task.completed ? "text-muted-foreground line-through" : ""}>{task.title}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Add a note..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                />
                <Button size="icon" onClick={handleAddNote} aria-label="Add note"><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-col gap-2">
                {(notes ?? []).length === 0 && <p className="text-xs text-muted-foreground">No notes yet.</p>}
                {(notes ?? []).map((note) => (
                  <div key={note.id} className="rounded-md bg-accent/40 p-2.5 text-sm">
                    <p>{note.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{new Date(note.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Opportunity Score</CardTitle>
              <CardDescription>{lead.score.recommendation}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-semibold tabular-nums">{lead.score.score}</span>
                <span className="text-sm text-muted-foreground">/ 100</span>
                <Badge variant={lead.score.priority === "URGENT" ? "destructive" : lead.score.priority === "HIGH" ? "warning" : "muted"} className="ml-auto">
                  {lead.score.priority}
                </Badge>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {lead.score.breakdown.map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium text-success">+{item.points}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <Row label="Phone" value={lead.phone} />
              <Row label="Email" value={lead.email} />
              <Row label="Website" value={lead.website} />
              <Row label="Instagram" value={lead.social.instagram ? `@${lead.social.instagram}` : undefined} />
              <Row label="Source" value={lead.source} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {(activity ?? []).length === 0 && <p className="text-xs text-muted-foreground">No activity yet.</p>}
              {(activity ?? []).map((entry) => (
                <div key={entry.id} className="flex gap-2 text-xs">
                  <span className="w-16 shrink-0 rounded bg-accent px-1.5 py-0.5 text-center text-[10px] text-muted-foreground">
                    {entry.type}
                  </span>
                  <span>{entry.message}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}
