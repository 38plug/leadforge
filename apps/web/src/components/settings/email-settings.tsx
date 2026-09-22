"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Mail, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useApi } from "@/lib/use-api";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { ApiEmailSettings } from "@/types/api";

interface FormState {
  from_address: string;
  from_name: string;
  reply_to: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  daily_send_limit: number;
}

const EMPTY: FormState = {
  from_address: "",
  from_name: "",
  reply_to: "",
  smtp_host: "",
  smtp_port: 587,
  smtp_username: "",
  smtp_password: "",
  daily_send_limit: 200,
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmailSettings() {
  const { data, loading, error, refetch } = useApi<ApiEmailSettings>("/api/workspace/email-settings");
  const { user } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState("");

  useEffect(() => {
    if (!data?.configured) return;
    setForm({
      from_address: data.from_address ?? "",
      from_name: data.from_name ?? "",
      reply_to: data.reply_to ?? "",
      smtp_host: data.smtp_host ?? "",
      smtp_port: data.smtp_port ?? 587,
      smtp_username: data.smtp_username ?? "",
      // Never populated from the server — it is not sent back.
      smtp_password: "",
      daily_send_limit: data.daily_send_limit ?? 200,
    });
  }, [data]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /** Fill in the SMTP host automatically for well-known mail domains. */
  const suggestHost = async (email: string) => {
    if (!email.includes("@")) return;
    try {
      const hit = await api.get<{ known: boolean; smtp_host?: string; smtp_port?: number }>(
        `/api/workspace/email-settings/suggest?email=${encodeURIComponent(email)}`
      );
      if (hit.known && hit.smtp_host) {
        setForm((prev) => ({
          ...prev,
          smtp_host: prev.smtp_host || hit.smtp_host!,
          smtp_port: prev.smtp_host ? prev.smtp_port : hit.smtp_port ?? 587,
          smtp_username: prev.smtp_username || email,
        }));
      }
    } catch {
      // A failed suggestion is not worth interrupting the user for.
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      // An empty password means "keep the one already stored".
      if (!form.smtp_password) delete payload.smtp_password;
      await api.put("/api/workspace/email-settings", payload);
      toast({ title: "Mailbox saved", description: "Send a test message to confirm it works.", variant: "success" });
      setForm((prev) => ({ ...prev, smtp_password: "" }));
      refetch();
    } catch (err) {
      toast({
        title: "Could not save",
        description: err instanceof ApiError ? err.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const result = await api.post<{ message: string }>("/api/workspace/email-settings/test", {
        to: testTo || user?.email,
      });
      toast({ title: "Test sent", description: result.message, variant: "success" });
      refetch();
    } catch (err) {
      toast({
        title: "Test failed",
        description: err instanceof ApiError ? err.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setTesting(false);
    }
  };

  const disconnect = async () => {
    try {
      await api.delete("/api/workspace/email-settings");
      setForm(EMPTY);
      toast({ title: "Mailbox disconnected", description: "Campaigns will not send until you connect one again.", variant: "info" });
      refetch();
    } catch (err) {
      toast({
        title: "Could not disconnect",
        description: err instanceof ApiError ? err.message : "Unknown error",
        variant: "error",
      });
    }
  };

  if (loading) return <LoadingState label="Loading email settings..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const canSave = Boolean(
    form.from_address && form.smtp_host && (form.smtp_password || data?.configured)
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <CardTitle>Your Sending Mailbox</CardTitle>
              <CardDescription>
                Outreach goes out from your own address, so replies come back to you.
              </CardDescription>
            </div>
          </div>
          {data?.verified_at ? (
            <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" /> Verified</Badge>
          ) : data?.configured ? (
            <Badge variant="warning"><CircleAlert className="mr-1 h-3 w-3" /> Untested</Badge>
          ) : (
            <Badge variant="warning"><CircleAlert className="mr-1 h-3 w-3" /> Not connected</Badge>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Send from" hint="The address recipients will see.">
              <Input
                type="email"
                placeholder="you@yourdomain.com"
                value={form.from_address}
                onChange={(e) => set("from_address", e.target.value)}
                onBlur={(e) => suggestHost(e.target.value)}
              />
            </Field>
            <Field label="Sender name" hint="Shown beside your address in the inbox.">
              <Input
                placeholder="Your name or agency"
                value={form.from_name}
                onChange={(e) => set("from_name", e.target.value)}
              />
            </Field>
            <Field label="SMTP server">
              <Input
                placeholder="smtp.gmail.com"
                value={form.smtp_host}
                onChange={(e) => set("smtp_host", e.target.value)}
              />
            </Field>
            <Field label="Port" hint="587 for most providers, 465 for SSL.">
              <Input
                type="number"
                value={form.smtp_port}
                onChange={(e) => set("smtp_port", Number(e.target.value))}
              />
            </Field>
            <Field label="Username" hint="Usually the same as your address.">
              <Input
                placeholder="you@yourdomain.com"
                value={form.smtp_username}
                onChange={(e) => set("smtp_username", e.target.value)}
              />
            </Field>
            <Field
              label={data?.configured ? "App password (leave blank to keep)" : "App password"}
              hint="Stored encrypted. It is never shown again after saving."
            >
              <Input
                type="password"
                placeholder={data?.configured ? "••••••••••••" : "16-character app password"}
                value={form.smtp_password}
                onChange={(e) => set("smtp_password", e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Reply-to (optional)" hint="Leave blank to use your sending address.">
              <Input
                type="email"
                value={form.reply_to}
                onChange={(e) => set("reply_to", e.target.value)}
              />
            </Field>
            <Field label="Daily send limit" hint="Stay under your provider's cap. Gmail allows ~500/day.">
              <Input
                type="number"
                value={form.daily_send_limit}
                onChange={(e) => set("daily_send_limit", Number(e.target.value))}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} disabled={saving || !canSave}>
              {saving ? "Saving..." : data?.configured ? "Save changes" : "Connect mailbox"}
            </Button>
            {data?.configured && (
              <Button variant="ghost" onClick={disconnect}>
                Disconnect
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-xs font-medium">Send a test message</p>
              <div className="flex flex-wrap gap-2">
                <Input
                  type="email"
                  className="max-w-xs"
                  placeholder={user?.email ?? "you@example.com"}
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                />
                <Button variant="outline" onClick={sendTest} disabled={testing}>
                  {testing ? "Sending..." : "Send test"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Campaigns will not send until a test message has been delivered successfully.
              </p>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Using a Gmail address</CardTitle>
          <CardDescription>Gmail needs an app password, not your normal password.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            1. Turn on 2-Step Verification at{" "}
            <a
              className="inline-flex items-center gap-1 underline hover:text-foreground"
              href="https://myaccount.google.com/security"
              target="_blank"
              rel="noreferrer"
            >
              Google Security <ExternalLink className="h-3 w-3" />
            </a>
          </p>
          <p>
            2. Create an app password at{" "}
            <a
              className="inline-flex items-center gap-1 underline hover:text-foreground"
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
            >
              App passwords <ExternalLink className="h-3 w-3" />
            </a>
          </p>
          <p>3. Paste the 16 characters above, without the spaces. The server is filled in for you.</p>
          <p className="text-[11px] leading-relaxed">
            Gmail is fine for getting started, but it is not built for cold outreach — heavy sending can get the
            account limited. Once volume grows, move to a dedicated domain and mailbox.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
