"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, Search, ChevronDown, LogOut, Settings as SettingsIcon, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initials, cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { ApiNotification } from "@/types/api";
import { titleForPath } from "@/lib/navigation";

/**
 * Ultra-thin command bar — says where you are, provides search, gets out.
 * Replaces the thick topbar with an editorial-grade header.
 */
export function Topbar({ onOpenNav }: { onOpenNav?: () => void }) {
  const { user, workspace, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
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
    function onClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  function openCommandPalette() {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true })
    );
  }

  const displayName = user?.full_name || user?.email || "Account";
  const title = titleForPath(pathname ?? "");

  return (
    <header className="command-bar">
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="rounded p-1 text-white/30 hover:text-white/60 md:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Left: Logo */}
      <div className="command-bar-logo">
        <span className="hidden md:inline">LEADFORGE</span>
      </div>

      {/* Center: Page title + system status */}
      <div className="command-bar-center">
        <span className="text-white/50">{title}</span>
        <span className="hidden items-center gap-1.5 sm:flex">
          <span
            className="h-1 w-1 rounded-full"
            style={{
              background: "hsl(82 100% 61%)",
              boxShadow: "0 0 4px hsl(82 100% 61% / 0.4)",
            }}
          />
          <span className="text-white/20">ENGINE ACTIVE</span>
        </span>
      </div>

      {/* Right: Search + Notifications + Account */}
      <div className="command-bar-right">
        {/* Search trigger */}
        <button
          type="button"
          onClick={openCommandPalette}
          className="hidden items-center gap-1.5 rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-white/25 transition-colors hover:border-white/[0.1] hover:text-white/40 sm:flex"
        >
          <Search className="h-3 w-3" />
          <span className="text-[9px]">SEARCH</span>
          <kbd className="ml-1 rounded border border-white/[0.06] bg-white/[0.03] px-1 py-0.5 text-[8px] text-white/20">
            ⌘K
          </kbd>
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={openCommandPalette}
          aria-label="Search"
          className="h-7 w-7 text-white/30 hover:text-white/60 sm:hidden"
        >
          <Search className="h-3.5 w-3.5" />
        </Button>

        {/* Notifications */}
        <button
          className="relative rounded p-1 text-white/30 hover:text-white/60"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="h-3.5 w-3.5" />
          {unreadCount > 0 && (
            <span
              className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full"
              style={{
                background: "hsl(82 100% 61%)",
                boxShadow: "0 0 4px hsl(82 100% 61% / 0.5)",
              }}
            />
          )}
        </button>

        {/* Account menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-1.5 rounded py-1 pl-1 pr-1.5 transition-colors hover:bg-white/[0.04]"
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[9px] font-bold text-primary"
            >
              {initials(displayName)}
            </span>
            <ChevronDown className="h-3 w-3 text-white/20" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-lg border border-white/[0.08] bg-[#0a0a0a]/95 p-1 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl"
            >
              <div className="px-2.5 py-2">
                <p className="truncate text-[12px] font-medium text-white/70">{displayName}</p>
                <p className="truncate text-[10px] text-white/30">{workspace?.name}</p>
              </div>
              <div className="my-1 h-px bg-white/[0.06]" />
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] text-white/40 transition-colors hover:bg-white/[0.04] hover:text-white/60"
              >
                <SettingsIcon className="h-3.5 w-3.5" /> Settings
              </Link>
              <button
                role="menuitem"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] text-red-400/60 transition-colors hover:bg-red-500/[0.06] hover:text-red-400/80"
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
