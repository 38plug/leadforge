import { Badge } from "@/components/ui/badge";
import type { LeadStatus, WebsiteStatus } from "@/types/lead";

// Re-exported so existing imports of ScorePill from this module keep working
// while the score components live in one place.
export { ScorePill, ScoreRing, ScoreBreakdown } from "@/components/leads/opportunity-score";

type Variant = "default" | "secondary" | "success" | "warning" | "destructive" | "muted" | "outline" | "signal";

/**
 * Pipeline stage. Colour tracks progress toward a deal rather than being
 * assigned arbitrarily: neutral early, accent once a conversation is live,
 * green only at Won.
 */
const statusMap: Record<LeadStatus, { label: string; variant: Variant }> = {
  NEW: { label: "New", variant: "secondary" },
  RESEARCHED: { label: "Researched", variant: "muted" },
  CONTACTED: { label: "Contacted", variant: "outline" },
  REPLIED: { label: "Replied", variant: "default" },
  INTERESTED: { label: "Interested", variant: "default" },
  MEETING: { label: "Meeting", variant: "warning" },
  PROPOSAL: { label: "Proposal", variant: "warning" },
  WON: { label: "Won", variant: "success" },
  LOST: { label: "Lost", variant: "muted" },
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const config = statusMap[status];
  return (
    <Badge variant={config.variant} dot>
      {config.label}
    </Badge>
  );
}

/**
 * Website status is the product's strongest buying signal, so "no website"
 * gets the one emphatic treatment in the set. It still describes what was
 * detected rather than asserting the business is a customer - a site can
 * exist and simply not be reachable from here.
 */
const websiteMap: Record<WebsiteStatus, { label: string; variant: Variant }> = {
  NO_WEBSITE: { label: "No website", variant: "signal" },
  ACTIVE: { label: "Active site", variant: "muted" },
  INACCESSIBLE: { label: "Unreachable", variant: "warning" },
  REDIRECTED: { label: "Redirected", variant: "outline" },
  OUTDATED: { label: "Outdated", variant: "warning" },
  UNKNOWN: { label: "Unknown", variant: "outline" },
};

export function WebsiteStatusBadge({ status }: { status: WebsiteStatus }) {
  const config = websiteMap[status];
  return (
    <Badge variant={config.variant} dot={status === "NO_WEBSITE"}>
      {config.label}
    </Badge>
  );
}
