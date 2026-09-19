import {
  LayoutDashboard,
  Radar,
  Users,
  KanbanSquare,
  Send,
  Sparkles,
  BarChart3,
  FileText,
  Database,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * One definition of the application's structure, consumed by the sidebar, the
 * command palette and the page-title lookup in the top bar.
 *
 * Labels are the product's vocabulary - Discover, Pipeline, Outreach - while
 * the hrefs stay on the existing routes. Renaming a route would break saved
 * links and bookmarks for no user-visible gain.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the command palette to disambiguate similar entries. */
  hint?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  /** Rendered only for platform administrators. Hiding it is presentation,
   *  not protection - the endpoints behind it check on the server. */
  adminOnly?: boolean;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    // The daily loop: find an opportunity, judge it, act on it.
    label: "Acquire",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard, hint: "Today's opportunities" },
      { href: "/lead-finder", label: "Discover", icon: Radar, hint: "Find new businesses" },
      { href: "/leads", label: "Leads", icon: Users, hint: "Everything you've saved" },
      { href: "/crm", label: "Pipeline", icon: KanbanSquare, hint: "Move deals forward" },
      { href: "/campaigns", label: "Outreach", icon: Send, hint: "Campaigns and sending" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/ai-assistant", label: "AI Workspace", icon: Sparkles, hint: "Turn data into action" },
      { href: "/analytics", label: "Analytics", icon: BarChart3, hint: "Funnel and performance" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/templates", label: "Templates", icon: FileText, hint: "Reusable email copy" },
      { href: "/data-sources", label: "Data Sources", icon: Database, hint: "Where businesses come from" },
      { href: "/settings", label: "Settings", icon: Settings, hint: "Account, team, billing" },
    ],
  },
];

export const ADMIN_NAV_GROUP: NavGroup = {
  label: "Platform",
  adminOnly: true,
  items: [
    { href: "/admin", label: "Admin", icon: ShieldCheck, hint: "Accounts, workspaces, coupons" },
  ],
};

export const ALL_NAV_ITEMS: NavItem[] = [...NAV_GROUPS, ADMIN_NAV_GROUP].flatMap(
  (group) => group.items
);

/** The page title shown in the top bar, matched longest-prefix first. */
export function titleForPath(pathname: string): string {
  const match = [...ALL_NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
  return match?.label ?? "LeadForge";
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
