"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Phone, Mail, Globe, MapPin, Lock, Loader2, Sparkles, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface RevealedContact {
  lead_id: string;
  phone: string | null;
  email: string | null;
  maps_url: string | null;
  website: string | null;
  used: number;
  limit: number;
  remaining: number;
  included_remaining: number;
  credit_balance: number;
}

/**
 * Unlocks one lead's contact details, spending one of the plan's leads.
 *
 * The details are genuinely absent from the API response until this is
 * clicked - they are not merely blurred - so the placeholder below stands in
 * for data the browser has never received. That is what makes the limit real
 * rather than a CSS effect anyone can inspect their way around.
 *
 * Reopening the same lead within the week is free, so a user who returns to a
 * lead they already opened is not charged twice. Unlocks are scoped to the
 * week they were bought in, so the same lead does cost again next week.
 */
export function RevealContact({
  leadId,
  revealed,
  phone,
  email,
  website,
  mapsUrl,
  onRevealed,
}: {
  leadId: string;
  revealed: boolean;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  mapsUrl?: string | null;
  /** Lets the page refresh its own copy of the lead and the usage meter. */
  onRevealed?: (contact: RevealedContact) => void;
}) {
  const { toast } = useToast();
  const [unlocking, setUnlocking] = useState(false);
  const [contact, setContact] = useState<RevealedContact | null>(null);
  const [quotaSpent, setQuotaSpent] = useState<{ limit: number; plan: string } | null>(null);

  const isOpen = revealed || contact !== null;

  // Opening a lead unlocks it. That is the product's model: a lead you have
  // looked at is one you have used, so the number counts leads rather than
  // clicks on a second button.
  //
  // The guard matters because React runs effects twice in development and the
  // component remounts on navigation - without it the same lead would be
  // requested repeatedly. The request is idempotent server-side, so a repeat
  // costs nothing, but there is no reason to make it.
  const requested = useRef(false);
  useEffect(() => {
    if (isOpen || unlocking || quotaSpent || requested.current) return;
    requested.current = true;
    void unlock();
    // unlock is stable for the lifetime of this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, leadId]);
  const shownPhone = contact?.phone ?? phone ?? null;
  const shownEmail = contact?.email ?? email ?? null;
  const shownWebsite = contact?.website ?? website ?? null;
  const shownMaps = contact?.maps_url ?? mapsUrl ?? null;

  async function unlock() {
    setUnlocking(true);
    try {
      const result = await api.post<RevealedContact>(`/api/leads/${leadId}/reveal`);
      setContact(result);
      onRevealed?.(result);
      // Warn on what is actually left to spend, packs included - telling
      // someone they are nearly out while they hold 200 bought credits would
      // be pushing an upgrade they do not need.
      if (result.remaining <= 5) {
        toast({
          title: `${result.remaining} leads left`,
          description: "Your allowance refills on Monday, or buy a pack to keep going.",
          variant: "info",
        });
      }
    } catch (err) {
      // 402 is the allowance being spent, which is a different situation from
      // a failure and gets its own explanation rather than a red toast.
      if (err instanceof ApiError && err.status === 402) {
        const detail = err.message as unknown as { limit?: number; plan?: string } | string;
        setQuotaSpent(
          typeof detail === "object"
            ? { limit: detail.limit ?? 0, plan: detail.plan ?? "your" }
            : { limit: 0, plan: "your" }
        );
      } else {
        toast({
          title: "Couldn't unlock this lead",
          description: err instanceof ApiError ? err.message : "Please try again.",
          variant: "error",
        });
      }
    } finally {
      setUnlocking(false);
    }
  }

  if (quotaSpent) {
    return (
      <div className="rounded-lg border border-warning/25 bg-warning/[0.07] p-4">
        <p className="flex items-center gap-2 text-[13px] font-medium text-warning">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          You&apos;ve used every lead included this week
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Your allowance refills on Monday. If you need more before then, a pack of extra
          leads is a one-off purchase and does not expire.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/settings?tab=billing">
              <ShoppingCart className="h-3.5 w-3.5" />
              Buy more leads
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href="/settings?tab=billing">
              <Sparkles className="h-3.5 w-3.5" />
              Upgrade your plan
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div className="rounded-lg border border-border bg-background/40 p-4">
        <div className="flex flex-col gap-2" aria-hidden="true">
          {/* Placeholders, not blurred data: the browser has never received
              these values, so there is nothing here to inspect. */}
          {["w-40", "w-52", "w-32"].map((width) => (
            <div key={width} className={cn("h-3.5 rounded bg-muted", width)} />
          ))}
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-border pt-3.5">
          {unlocking ? (
            <span className="flex items-center gap-2 text-2xs text-muted-foreground" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Unlocking contact details...
            </span>
          ) : (
            <Button size="sm" onClick={unlock}>
              <Lock className="h-3.5 w-3.5" />
              Show contact details
            </Button>
          )}
          <span className="text-2xs text-subtle-foreground">
            Uses one lead from your weekly allowance
          </span>
        </div>
      </div>
    );
  }

  const rows = [
    { icon: Phone, label: "Phone", value: shownPhone, href: shownPhone ? `tel:${shownPhone}` : null },
    { icon: Mail, label: "Email", value: shownEmail, href: shownEmail ? `mailto:${shownEmail}` : null },
    { icon: Globe, label: "Website", value: shownWebsite, href: shownWebsite ?? null },
    { icon: MapPin, label: "Map", value: shownMaps ? "Open in maps" : null, href: shownMaps ?? null },
  ].filter((row) => row.value);

  return (
    <div className="rounded-lg border border-border bg-background/40 p-4">
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          This business publishes no contact details. That is common for the ones most in need of a
          web presence — and it is why the address and map are worth having.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <li key={row.label} className="flex items-center gap-2.5 text-[13px]">
                <Icon className="h-3.5 w-3.5 shrink-0 text-subtle-foreground" aria-hidden="true" />
                <span className="w-16 shrink-0 text-2xs text-subtle-foreground">{row.label}</span>
                {row.href ? (
                  <a
                    href={row.href}
                    target={row.href.startsWith("http") ? "_blank" : undefined}
                    rel="noreferrer"
                    className="min-w-0 truncate transition-colors hover:text-primary"
                  >
                    {row.value}
                  </a>
                ) : (
                  <span className="min-w-0 truncate">{row.value}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {contact && (
        <p className="mt-3 border-t border-border pt-2.5 text-2xs text-subtle-foreground">
          <span className="numeric">{contact.included_remaining}</span> of{" "}
          <span className="numeric">{contact.limit}</span> leads left this week
          {contact.credit_balance > 0 && (
            <>
              {" "}
              &middot; <span className="numeric">{contact.credit_balance}</span> bought
            </>
          )}
        </p>
      )}
    </div>
  );
}
