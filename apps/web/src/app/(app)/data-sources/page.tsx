"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Database, Globe, Mail, Sparkles, Share2, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState, ErrorState } from "@/components/ui/state";
import { useApi } from "@/lib/use-api";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { ApiProviderStatus } from "@/types/api";

type TestState = { status: "idle" | "running" | "ok" | "failed"; message?: string };

function TestResult({ state }: { state: TestState }) {
  if (state.status === "idle" || state.status === "running") return null;
  return (
    <p className={`text-[11px] ${state.status === "ok" ? "text-success" : "text-destructive"}`}>
      {state.message}
    </p>
  );
}

const ICONS: Record<string, LucideIcon> = {
  business: Database,
  website: Globe,
  social: Share2,
  ai: Sparkles,
  email: Mail,
};

export default function DataSourcesPage() {
  const { data, loading, error, refetch } = useApi<{ providers: ApiProviderStatus[] }>("/api/providers");
  const { user } = useAuth();

  const [aiTest, setAiTest] = useState<TestState>({ status: "idle" });

  const runTest = async (
    path: string,
    body: unknown,
    set: (state: TestState) => void
  ) => {
    set({ status: "running" });
    try {
      const result = await api.post<{ message: string }>(path, body);
      set({ status: "ok", message: result.message });
    } catch (err) {
      set({ status: "failed", message: err instanceof ApiError ? err.message : "Test failed" });
    }
  };

  if (loading) return <LoadingState label="Checking providers..." />;
  if (error || !data) return <ErrorState message={error ?? "No data"} onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Data Sources</h1>
        <p className="text-sm text-muted-foreground">
          Live status of every integration, read from the running server — not a static list.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.providers.map((p) => {
          const Icon = ICONS[p.key] ?? Database;
          return (
            <Card key={p.key}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle>{p.name}</CardTitle>
                    <CardDescription>{p.description}</CardDescription>
                  </div>
                </div>
                {p.live ? (
                  <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" /> Live</Badge>
                ) : (
                  <Badge variant="warning"><CircleAlert className="mr-1 h-3 w-3" /> Not configured</Badge>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>Active: <span className="font-medium text-foreground">{p.active}</span></span>
                  <span className="shrink-0 font-mono">{p.env_var}</span>
                </div>
                {p.note && <p className="text-[11px] leading-relaxed">{p.note}</p>}

                {p.key === "ai" && p.live && (
                  <div className="mt-1 flex flex-col gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-fit"
                      disabled={aiTest.status === "running"}
                      onClick={() => runTest("/api/providers/ai/test", {}, setAiTest)}
                    >
                      {aiTest.status === "running" ? "Testing..." : "Test connection"}
                    </Button>
                    <TestResult state={aiTest} />
                  </div>
                )}

                {p.key === "email" && (
                  <Button size="sm" variant="outline" className="mt-1 w-fit" asChild>
                    <Link href="/settings">
                      {p.live ? "Manage mailbox" : "Connect your mailbox"}
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connecting the optional providers</CardTitle>
          <CardDescription>Lead discovery already runs for free — these two are extras.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Set these in <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">apps/api/.env</code> and
            restart the API. Nothing else changes.
          </p>
          <div>
            <p className="font-medium text-foreground">Real AI output</p>
            <p className="text-xs">
              <code className="font-mono">AI_PROVIDER_API_KEY=sk-ant-...</code> — until then, lead analysis is generated
              from each lead&apos;s own stored attributes rather than by a model.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Actually sending outreach</p>
            <p className="text-xs">
              <code className="font-mono">SMTP_HOST</code>, <code className="font-mono">SMTP_USERNAME</code>,{" "}
              <code className="font-mono">SMTP_PASSWORD</code> — any mail host works, including a free Gmail app
              password. Until then campaigns run end to end but no mail leaves the server.
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Business data ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
          OpenStreetMap contributors
        </a>
        , available under the Open Database License.
      </p>
    </div>
  );
}
