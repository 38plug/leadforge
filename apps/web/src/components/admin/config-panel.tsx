"use client";

import { Check, X, ServerCog, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ErrorState, SkeletonRows } from "@/components/ui/state";
import { useApi } from "@/lib/use-api";
import type { AdminConfigStatus } from "@/types/api";
import { cn } from "@/lib/utils";

/**
 * What the running server can actually see.
 *
 * "I added the key but it still doesn't work" otherwise means guessing between
 * a missing value, a misspelled name, a file the app never reads and a service
 * that was never restarted. This shows which it is.
 *
 * Presence only, never values, so the panel is safe on screen and safe to
 * screenshot into a support thread.
 */

/** Grouped so a missing value is read next to the feature it disables. */
const GROUPS: { title: string; keys: string[]; note: string }[] = [
  {
    title: "Core",
    keys: ["DATABASE_URL", "JWT_SECRET", "SECRET_ENCRYPTION_KEY"],
    note: "Without these the API refuses to start in production.",
  },
  {
    title: "Payments",
    keys: [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRICE_STARTER",
      "STRIPE_PRICE_PRO",
      "STRIPE_PRICE_AGENCY",
    ],
    note: "All five are needed before a plan can be sold. Without the webhook secret a customer can pay and never be upgraded.",
  },
  {
    title: "Optional",
    keys: ["AI_PROVIDER_API_KEY", "SMTP_HOST", "OSM_CONTACT"],
    note: "Each one missing disables a feature rather than breaking the product: AI analysis falls back to rules, and password-reset email cannot be delivered.",
  },
];

export function AdminConfigPanel() {
  const { data, loading, error, refetch } = useApi<AdminConfigStatus>("/api/admin/config-status");

  if (loading) {
    return (
      <Card className="p-4">
        <SkeletonRows rows={5} />
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <ErrorState title="Configuration could not be read" message={error} onRetry={refetch} />
      </Card>
    );
  }
  if (!data) return null;

  const missingPayments = GROUPS[1].keys.filter((key) => data.settings[key] !== "set");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ServerCog className="h-4 w-4 text-subtle-foreground" aria-hidden="true" />
          <CardTitle>Server configuration</CardTitle>
        </div>
        <CardDescription>
          What the running API can see. Names only — no values are shown or sent.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-2xs text-subtle-foreground">
          <span>
            Environment: <span className="text-muted-foreground">{data.environment}</span>
          </span>
          <span>
            Secret files mounted:{" "}
            <span className="text-muted-foreground">
              {data.secret_files_mounted.join(", ") || "none"}
            </span>
          </span>
        </div>

        {missingPayments.length > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <p className="text-xs leading-relaxed">
              <span className="font-medium text-warning">Payments are not live.</span>{" "}
              <span className="text-muted-foreground">
                {missingPayments.length} of 5 Stripe settings are missing, so no plan can be
                purchased. Add them to the server&apos;s environment and redeploy — saving without a
                redeploy leaves the old process running with the old configuration.
              </span>
            </p>
          </div>
        )}

        {GROUPS.map((group) => (
          <div key={group.title}>
            <p className="label-caps mb-2">{group.title}</p>
            <ul className="flex flex-col gap-1.5">
              {group.keys.map((key) => {
                const value = data.settings[key];
                const ok = value === "set" || value === "postgres";
                return (
                  <li key={key} className="flex items-center gap-2.5 text-[13px]">
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                        ok ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                      )}
                      aria-hidden="true"
                    >
                      {ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                    </span>
                    <code className="font-mono text-xs">{key}</code>
                    <span
                      className={cn(
                        "ml-auto text-2xs",
                        ok ? "text-subtle-foreground" : "font-medium text-warning"
                      )}
                    >
                      {value ?? "unknown"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-2xs leading-relaxed text-subtle-foreground">{group.note}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
