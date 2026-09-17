"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, ChevronDown, LogOut, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { ApiNotification } from "@/types/api";

export function Topbar() {
  const { user, workspace, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    api
      .get<ApiNotification[]>("/api/notifications?unread_only=true")
      .then((items) => setUnreadCount(items.length))
      .catch(() => setUnreadCount(0));
  }, [user]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  const displayName = user?.full_name || user?.email || "Account";

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search leads, companies, campaigns..." className="pl-8" />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </Button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {initials(displayName)}
            </div>
            <span className="hidden text-[13px] font-medium sm:inline">{displayName}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-border bg-popover p-1 shadow-lg">
              <div className="px-2.5 py-2">
                <p className="truncate text-[13px] font-medium">{displayName}</p>
                <p className="truncate text-[11px] text-muted-foreground">{workspace?.name}</p>
              </div>
              <div className="my-1 h-px bg-border" />
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-[13px] hover:bg-accent"
              >
                <SettingsIcon className="h-3.5 w-3.5" /> Settings
              </Link>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-[13px] text-destructive hover:bg-accent"
              >
                <LogOut className="h-3.5 w-3.5" /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
