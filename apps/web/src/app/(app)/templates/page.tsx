"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { Plus, Trash2, Save } from "lucide-react";
import { useApi } from "@/lib/use-api";
import { api, ApiError } from "@/lib/api";
import type { ApiEmailTemplate } from "@/types/api";

const VARIABLES = [
  "first_name", "company_name", "industry", "city", "country", "website", "instagram", "rating",
];

const SAMPLE_DATA: Record<string, string> = {
  first_name: "Maria",
  company_name: "Bella Vista Ristorante",
  industry: "Restaurant",
  city: "Miami",
  country: "United States",
  website: "N/A",
  instagram: "@bellavistamiami",
  rating: "4.8",
};

const DEFAULT_BODY = `Hi {{first_name}},

I came across {{company_name}} and noticed your business has a strong local presence in {{city}}.

I noticed there may be an opportunity to improve your online presence with a dedicated website — happy to send over a couple of quick ideas if useful.

Would you be open to a short call this week?`;

function renderTemplate(text: string, data: Record<string, string>) {
  return text.replace(/{{\s*(\w+)\s*}}/g, (match, key) => data[key] ?? match);
}

export default function TemplatesPage() {
  const { data: templates, loading, error, refetch } = useApi<ApiEmailTemplate[]>("/api/email-templates");
  const { toast } = useToast();

  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [name, setName] = useState("Cold Outreach — No Website");
  const [subject, setSubject] = useState("Quick idea for {{company_name}}");
  const [body, setBody] = useState(DEFAULT_BODY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (templates && templates.length > 0 && selectedId === null) {
      selectTemplate(templates[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates]);

  function selectTemplate(t: ApiEmailTemplate) {
    setSelectedId(t.id);
    setName(t.name);
    setSubject(t.subject);
    setBody(t.body);
  }

  function startNew() {
    setSelectedId("new");
    setName("New Template");
    setSubject("");
    setBody("");
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (selectedId === "new" || selectedId === null) {
        const created = await api.post<ApiEmailTemplate>("/api/email-templates", { name, subject, body });
        setSelectedId(created.id);
      } else {
        await api.patch(`/api/email-templates/${selectedId}`, { name, subject, body });
      }
      refetch();
      toast({ title: "Template saved", variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't save template", description: err instanceof ApiError ? err.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedId || selectedId === "new") return;
    try {
      await api.delete(`/api/email-templates/${selectedId}`);
      setSelectedId(null);
      refetch();
      toast({ title: "Template deleted", variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't delete template", description: err instanceof ApiError ? err.message : undefined, variant: "error" });
    }
  }

  const previewSubject = useMemo(() => renderTemplate(subject, SAMPLE_DATA), [subject]);
  const previewBody = useMemo(() => renderTemplate(body, SAMPLE_DATA), [body]);

  if (loading) return <LoadingState label="Loading templates..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Email Templates</h1>
          <p className="text-sm text-muted-foreground">Editable templates with live variable preview.</p>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4" /> New Template</Button>
      </div>

      {templates && templates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTemplate(t)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selectedId === t.id ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Editor</CardTitle>
              <CardDescription>Give it a descriptive name</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}><Save className="h-3.5 w-3.5" /> Save</Button>
              {selectedId && selectedId !== "new" && (
                <Button size="sm" variant="outline" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Template name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Subject</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Variables</CardTitle>
            <CardDescription>Click to insert</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {VARIABLES.map((v) => (
              <button
                key={v}
                onClick={() => setBody((b) => `${b}{{${v}}}`)}
                className="rounded-md border border-border px-2 py-1 text-xs font-mono text-muted-foreground hover:border-primary/50 hover:text-primary"
              >
                {`{{${v}}}`}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Rendered with sample lead data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border p-4">
              <p className="mb-3 border-b border-border pb-2 text-sm font-medium">{previewSubject}</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{previewBody}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
