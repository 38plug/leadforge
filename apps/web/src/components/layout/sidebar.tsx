"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Users,
  KanbanSquare,
  Megaphone,
  FileText,
  Sparkles,
  BarChart3,
  Database,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo-mark";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { ApiUsage } from "@/types/api";

const primaryNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lead-finder", label: "Lead Finder", icon: Search },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/crm", label: "CRM", icon: KanbanSquare },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/ai-assistant", label: "AI Assistant", icon: Sparkles },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/data-sources", label: "Data Sources", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];

const PLAN_LIMITS: Record<string, number> = {
  FREE: 50,
  STARTER: 500,
  PRO: 2000,
  AGENCY: 10000,
  BUSINESS: 100000,
};

export function Sidebar() {
  const pathname = usePathname();
  const { workspace } = useAuth();
  const [usage, setUsage] = useState<ApiUsage | null>(null);

  useEffect(() => {
    if (!workspace) return;
    api
      .get<ApiUsage>("/api/workspace/usage")
      .then(setUsage)
      .catch(() => setUsage(null));
  }, [workspace]);

  const limit = PLAN_LIMITS[workspace?.plan ?? "FREE"] ?? 50;
  const used = usage?.lead_searches ?? 0;
  const pct = Math.min(100, Math.round((used / limit) * 100));

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card/40 md:flex">
      <div className="group flex h-14 items-center gap-2.5 border-b border-border px-4">
        <span className="transition-transform duration-500 group-hover:rotate-[10deg] group-hover:scale-110">
          <LogoMark size={26} />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">LeadForge</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-none">
        <ul className="stagger flex flex-col gap-0.5">
          {primaryNav.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group/nav relative flex items-center gap-2.5 overflow-hidden rounded-md px-2.5 py-2 text-[13px] font-medium",
                    "transition-all duration-200 hover:translate-x-0.5",
                    active
                      ? "bg-gradient-brand-wash text-foreground border border-violet/25"
                      : "border border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {/* Glowing rail marking the current section. */}
                  {active && (
                    <span
                      className="animate-slide-in-left absolute inset-y-1 left-0 w-[3px] rounded-full bg-gradient-brand"
                      style={{ boxShadow: "0 0 12px hsl(var(--glow-strong) / 0.9)" }}
                      aria-hidden="true"
                    />
                  )}
                  <Icon
                    className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover/nav:scale-110"
                    style={active ? { color: "hsl(var(--glow-strong))" } : undefined}
                  />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between rounded-md bg-accent/60 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{workspace?.name ?? "Workspace"}</p>
            <p className="text-[11px] text-muted-foreground">{workspace?.plan ?? "FREE"} plan</p>
          </div>
          <span className="shrink-0 rounded-full bg-gradient-brand px-2 py-0.5 text-[10px] font-bold text-brand-ink">
            {workspace?.plan ?? "FREE"}
          </span>
        </div>
        <div className="mt-2 space-y-1 px-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Lead searches</span>
            <span>{used.toLocaleString()} / {limit.toLocaleString()}</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </aside>
  );
}
