import { Badge } from "@/components/ui/badge";
import type { LeadStatus, WebsiteStatus } from "@/types/lead";
import { cn } from "@/lib/utils";

const statusMap: Record<LeadStatus, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "muted" }> = {
  NEW: { label: "New", variant: "secondary" },
  RESEARCHED: { label: "Researched", variant: "muted" },
  CONTACTED: { label: "Contacted", variant: "default" },
  REPLIED: { label: "Replied", variant: "warning" },
  INTERESTED: { label: "Interested", variant: "warning" },
  MEETING: { label: "Meeting", variant: "default" },
  PROPOSAL: { label: "Proposal", variant: "default" },
  WON: { label: "Won", variant: "success" },
  LOST: { label: "Lost", variant: "destructive" },
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const config = statusMap[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

const websiteMap: Record<WebsiteStatus, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "muted" }> = {
  NO_WEBSITE: { label: "No website", variant: "destructive" },
  ACTIVE: { label: "Active", variant: "success" },
  INACCESSIBLE: { label: "Inaccessible", variant: "warning" },
  REDIRECTED: { label: "Redirected", variant: "muted" },
  OUTDATED: { label: "Outdated", variant: "warning" },
  UNKNOWN: { label: "Unknown", variant: "muted" },
};

export function WebsiteStatusBadge({ status }: { status: WebsiteStatus }) {
  const config = websiteMap[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 85
      ? "bg-success/15 text-success"
      : score >= 70
      ? "bg-primary/15 text-primary"
      : score >= 50
      ? "bg-warning/15 text-warning"
      : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex h-6 min-w-9 items-center justify-center rounded-md px-1.5 text-xs font-semibold tabular-nums", tone)}>
      {score}
    </span>
  );
}
