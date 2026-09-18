"use client";

import Link from "next/link";
import { MapPin, Phone, Mail, Globe, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadStatusBadge, WebsiteStatusBadge } from "@/components/leads/badges";
import { ScoreRing } from "@/components/leads/opportunity-score";
import type { Lead } from "@/types/lead";

/**
 * One discovered business.
 *
 * The card answers the only question that matters at this stage - is this
 * worth my time - by pairing the score with the reasons behind it. Reasons
 * come from the API's score breakdown; nothing is asserted here that the
 * backend did not calculate.
 */
export function DiscoveryResultCard({ lead }: { lead: Lead }) {
  const reasons = lead.score.breakdown?.filter((factor) => factor.points > 0).slice(0, 3) ?? [];
  const contacts = [
    lead.phone ? { icon: Phone, value: lead.phone, label: "Phone" } : null,
    lead.email ? { icon: Mail, value: lead.email, label: "Email" } : null,
    lead.website ? { icon: Globe, value: lead.website, label: "Website" } : null,
  ].filter(Boolean) as { icon: typeof Phone; value: string; label: string }[];

  return (
    <article className="surface surface-interactive group rounded-xl p-4">
      <div className="flex items-start gap-3.5">
        <ScoreRing score={lead.score.score} size={46} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/leads/${lead.id}`}
                className="block truncate text-sm font-semibold transition-colors hover:text-primary"
              >
                {lead.company}
              </Link>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-2xs text-subtle-foreground">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {[lead.city, lead.country].filter(Boolean).join(", ")}
                </span>
                {lead.niche && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{lead.niche}</span>
                  </>
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <WebsiteStatusBadge status={lead.websiteStatus} />
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
              <LeadStatusBadge status={lead.status} />
              <Button asChild size="sm" variant="secondary">
                <Link href={`/leads/${lead.id}`}>
                  Open
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
