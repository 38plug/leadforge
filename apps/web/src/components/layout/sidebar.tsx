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
 * The command centre: always present, never competing with the work.
 *
 * It is a shade darker than the page so the content area reads as the lit
 * surface. The only accent in here is the current section, which is what lets
 * someone locate themselves in a glance without reading any labels.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { workspace, user } = useAuth();
  const [usage, setUsage] = useState<ApiUsage | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Restored after mount rather than during render: reading localStorage while
  // rendering would produce a server/client mismatch.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* private mode and blocked storage are both fine here */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* the preference simply won't persist */
      }
      return next;
    });
  }

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
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-border bg-[hsl(var(--background))] transition-[width] duration-200 ease-out",
        collapsed ? "w-[68px]" : "w-[248px]"
      )}
    >
      <div className="flex h-14 items-center gap-2.5 px-4">
        <Link href="/dashboard" onClick={onNavigate} className="group flex items-center gap-2.5">
          <span className="transition-transform duration-500 group-hover:rotate-[10deg]">
            <LogoMark size={24} />
          </span>
          {!collapsed && (
            <span className="text-[15px] font-semibold tracking-tight">LeadForge</span>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-none" aria-label="Main">
        {[...NAV_GROUPS, ...(user?.is_superuser ? [ADMIN_NAV_GROUP] : [])].map((group) => (
          <div key={group.label} className="mb-5">
            {!collapsed && <p className="label-caps mb-1.5 px-2.5">{group.label}</p>}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActivePath(pathname ?? "", item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group/nav relative flex items-center gap-2.5 rounded-md py-2 text-[13px] font-medium transition-colors duration-150",
                        collapsed ? "justify-center px-0" : "px-2.5",
                        active
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      {/* A short rail rather than a filled block: enough to
                          locate yourself, quiet enough to ignore. */}
                      {active && (
                        <span
                          className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-primary"
                          style={{ boxShadow: "0 0 10px hsl(var(--glow-strong) / 0.9)" }}
                          aria-hidden="true"
                        />
                      )}
                      <Icon
                        className={cn(
                          "h-[17px] w-[17px] shrink-0 transition-colors",
                          active ? "text-primary" : "text-subtle-foreground group-hover/nav:text-foreground"
                        )}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="px-3 pb-2">
          <Link
            href="/settings?tab=billing"
            onClick={onNavigate}
            aria-label={`Workspace usage: ${used} of ${limit} searches used. Open billing.`}
            className="surface surface-interactive block rounded-lg p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-medium">{workspace?.name ?? "Workspace"}</p>
              <span className="shrink-0 rounded-sm border border-primary/25 bg-primary/12 px-1.5 py-0.5 text-2xs font-semibold text-primary">
                {workspace?.plan ?? "FREE"}
              </span>
            </div>
            <div className="mt-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-2xs text-muted-foreground">
                <span>Searches</span>
                <span className="numeric">
                  {used.toLocaleString()} / {limit.toLocaleString()}
                </span>
              </div>
              <div
                className="h-1 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Lead searches used"
              >
                <div className="h-full rounded-full bg-primary/80" style={{ width: `${pct}%` }} />
              </div>
              <p className="pt-0.5 text-2xs text-subtle-foreground">View plan and usage</p>
            </div>
          </Link>
        </div>
      )}

      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            collapsed ? "justify-center px-0" : "px-2.5"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[17px] w-[17px]" />
          ) : (
            <>
              <PanelLeftClose className="h-[17px] w-[17px]" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
