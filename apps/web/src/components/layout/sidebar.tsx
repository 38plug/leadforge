"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo-mark";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { ApiUsage } from "@/types/api";
import { ADMIN_NAV_GROUP, NAV_GROUPS, isActivePath } from "@/lib/navigation";

const PLAN_LIMITS: Record<string, number> = {
  FREE: 50,
  STARTER: 500,
  PRO: 2000,
  AGENCY: 10000,
  BUSINESS: 100000,
};

const COLLAPSE_KEY = "leadforge_sidebar_collapsed";

/**
 * Instrument rail — narrow sidebar with icon-only navigation.
 * On hover, a flyout panel slides out showing labels for each item.
 */
export function Sidebar({
  onNavigate,
  expanded: forceExpanded,
}: {
  onNavigate?: () => void;
  expanded?: boolean;
}) {
  const pathname = usePathname();
  const { workspace, user } = useAuth();
  const [usage, setUsage] = useState<ApiUsage | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [flyoutY, setFlyoutY] = useState(0);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) !== "0");
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  useEffect(() => {
    if (!workspace) return;
    api
      .get<ApiUsage>("/api/workspace/usage")
      .then(setUsage)
      .catch(() => setUsage(null));
  }, [workspace, pathname]);

  const limit = usage?.lead_reveals_limit ?? PLAN_LIMITS[workspace?.plan ?? "FREE"] ?? 50;
  const used = usage?.lead_reveals ?? 0;
  const credits = usage?.credit_balance ?? 0;
  const plan = user?.is_superuser ? "Administrator" : (usage?.plan ?? workspace?.plan ?? "FREE");
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));

  const isExpanded = forceExpanded || !collapsed;
  const allGroups = [...NAV_GROUPS, ...(user?.is_superuser ? [ADMIN_NAV_GROUP] : [])];
  const allItems = allGroups.flatMap((g) => g.items);

  // Collapsed: icon rail with flyout panel
  if (!isExpanded) {
    return (
      <div className="relative flex h-full">
        {/* The rail */}
        <nav className="instrument-rail" aria-label="Main">
          {/* Logo */}
          <Link href="/dashboard" onClick={onNavigate} className="mb-3 flex items-center justify-center">
            <LogoMark size={22} />
          </Link>

          {/* Nav items */}
          {allItems.map((item) => {
            const active = isActivePath(pathname ?? "", item.href);
            const Icon = item.icon;
            return (
              <div
                key={item.href}
                className="relative"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const railRect = e.currentTarget.closest(".instrument-rail")?.getBoundingClientRect();
                  if (railRect) {
                    setFlyoutY(rect.top - railRect.top + rect.height / 2 - 18);
                  }
                  setHoveredItem(item.label);
                }}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn("instrument-rail-item", active && "active")}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </Link>
              </div>
            );
          })}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Usage pip */}
          <Link
            href="/settings?tab=billing"
            onClick={onNavigate}
            className="instrument-rail-item"
            title={`${plan} — ${used}/${limit} leads`}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: pct > 80 ? "hsl(28 85% 55%)" : "hsl(82 100% 61%)",
                boxShadow: `0 0 6px ${pct > 80 ? "hsl(28 85% 55% / 0.4)" : "hsl(82 100% 61% / 0.3)"}`,
              }}
            />
          </Link>

          {/* Collapse toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="instrument-rail-item"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="h-[16px] w-[16px]" />
          </button>
        </nav>

        {/* Flyout panel — single item slide-out */}
        {hoveredItem && (
          <div
            className="instrument-flyout"
            style={{ top: flyoutY }}
          >
            <div className="instrument-flyout-item">
              {hoveredItem}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Expanded: thin sidebar
  return (
    <div className="sidebar-expanded">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2">
          <LogoMark size={20} />
          <span className="text-[12px] font-bold tracking-tight text-white/60">LeadForge</span>
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="rounded p-1 text-white/20 hover:text-white/50"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2 pb-3 scrollbar-none" aria-label="Main">
        {allGroups.map((group) => (
          <div key={group.label} className="mb-3">
            <div className="sidebar-group-label">{group.label}</div>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActivePath(pathname ?? "", item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn("sidebar-item", active && "active")}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Usage */}
      <div className="px-3 pb-2">
        <Link
          href="/settings?tab=billing"
          onClick={onNavigate}
          className="block rounded-md border border-white/[0.05] bg-white/[0.02] p-2.5 transition-colors hover:border-white/[0.08]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[10px] font-medium text-white/50">
              {workspace?.name ?? "Workspace"}
            </span>
            <span className="shrink-0 rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold text-primary">
              {plan}
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between text-[9px] text-white/25">
              <span>Leads</span>
              <span className="font-variant-numeric:tabular-nums">
                {used.toLocaleString()} / {limit.toLocaleString()}
              </span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-primary/70 transition-[width] duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
