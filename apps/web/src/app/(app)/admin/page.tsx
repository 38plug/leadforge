"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/state";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { AdminOverviewPanel } from "@/components/admin/overview-panel";
import { AdminAccountsPanel } from "@/components/admin/accounts-panel";
import { AdminWorkspacesPanel } from "@/components/admin/workspaces-panel";
import { AdminCouponsPanel } from "@/components/admin/coupons-panel";

type Tab = "overview" | "accounts" | "workspaces" | "coupons";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "accounts", label: "Accounts" },
  { key: "workspaces", label: "Workspaces" },
  { key: "coupons", label: "Coupons" },
];

/**
 * Platform administration.
 *
 * The check below decides what is *shown*. It is not what makes this safe -
 * every endpoint behind these panels verifies the caller is a platform
 * administrator on the server, because a hidden link is not access control
 * and this page is one URL away for anyone who guesses it.
 */
export default function AdminPage() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  if (loading) return null;

  if (!user?.is_superuser) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Admin" />
        <Card>
          <EmptyState
            icon={ShieldAlert}
            title="You don't have platform access"
            description="This section is limited to platform administrators. If you should have access, another administrator can grant it."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Platform admin"
        description="Every account, workspace and coupon across the installation — not just your own."
      />

      <div
        role="tablist"
        aria-label="Admin sections"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {TABS.map((item) => (
          <button
            key={item.key}
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              "relative shrink-0 px-3 py-2 text-[13px] font-medium transition-colors",
              tab === item.key
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
            {tab === item.key && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && <AdminOverviewPanel />}
      {tab === "accounts" && <AdminAccountsPanel currentUserId={user.id} />}
      {tab === "workspaces" && <AdminWorkspacesPanel />}
      {tab === "coupons" && <AdminCouponsPanel />}
    </div>
  );
}
