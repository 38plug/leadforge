"use client";

import { useState } from "react";
import { MapPin, Phone, Mail, Globe, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WebsiteStatusBadge } from "@/components/leads/badges";
import { ScoreRing } from "@/components/leads/opportunity-score";
import type { LeadPreview } from "@/types/lead";

interface DiscoveryResultCardProps {
  preview: LeadPreview;
  onSave: (preview: LeadPreview) => Promise<void>;
}

export function DiscoveryResultCard({ preview, onSave }: DiscoveryResultCardProps) {
  const [saving, setSaving] = useState(false);
  const reasons = preview.score.breakdown?.filter((factor) => factor.points > 0).slice(0, 3) ?? [];
  const contacts = [
    preview.phone ? { icon: Phone, value: preview.phone, label: "Phone" } : null,
    preview.email ? { icon: Mail, value: preview.email, label: "Email" } : null,
    preview.website ? { icon: Globe, value: preview.website, label: "Website" } : null,
  ].filter(Boolean) as { icon: typeof Phone; value: string; label: string }[];

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(preview);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="surface surface-interactive group rounded-xl p-4">
      <div className="flex items-start gap-3.5">
        <ScoreRing score={preview.score.score} size={46} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">
                {preview.name}
              </h3>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-2xs text-subtle-foreground">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {[preview.city, preview.country].filter(Boolean).join(", ")}
                </span>
                {preview.niche && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{preview.niche}</span>
                  </>
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <WebsiteStatusBadge status={preview.website_status} />
            </div>
          </div>

          {reasons.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {reasons.map((reason) => (
                <li
                  key={reason.label}
                  className="rounded-sm border border-border bg-background/50 px-1.5 py-0.5 text-2xs text-muted-foreground"
                >
                  {reason.label}
                  <span className="numeric ml-1 text-subtle-foreground">+{reason.points}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              {contacts.length > 0 ? (
                contacts.map((contact) => {
                  const Icon = contact.icon;
                  return (
                    <span
                      key={contact.label}
                      className="flex min-w-0 items-center gap-1 text-2xs text-subtle-foreground"
                      title={contact.value}
                    >
                      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="max-w-[160px] truncate">{contact.value}</span>
                    </span>
                  );
                })
              ) : (
                <span className="text-2xs text-subtle-foreground">No contact details published</span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {preview.saved ? (
                <Button size="sm" variant="secondary" disabled>
                  <Check className="h-3.5 w-3.5" />
                  Saved
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save lead
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
