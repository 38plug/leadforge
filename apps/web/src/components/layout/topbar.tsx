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
 * Thin by design. The bar's job is to say where you are and get out of the
 * way; the search field is a doorway to the command palette rather than a
 * second search implementation, so there is one way to find things.
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
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  /** The palette listens for Cmd/Ctrl+K globally; clicking dispatches the same. */
  function openCommandPalette() {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true })
    );
  }

  const displayName = user?.full_name || user?.email || "Account";
  const title = titleForPath(pathname ?? "");

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="-ml-1 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      <h1 className="truncate text-[15px] font-semibold tracking-tight">{title}</h1>

      <button
        type="button"
        onClick={openCommandPalette}
        className={cn(
          "ml-auto hidden h-9 items-center gap-2.5 rounded-md border border-border bg-background/60 px-3 text-left text-sm text-subtle-foreground transition-colors sm:flex",
          "w-full max-w-[280px] hover:border-border-strong hover:text-muted-foreground"
        )}
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate">Search...</span>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-2xs text-subtle-foreground">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 sm:ml-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={openCommandPalette}
          aria-label="Search"
          className="sm:hidden"
        >
          <Search className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary"
              style={{ boxShadow: "0 0 8px hsl(var(--glow-strong))" }}
            />
          )}
        </Button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-md py-1.5 pl-1.5 pr-2 text-sm transition-colors hover:bg-accent"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/25 bg-primary/12 text-2xs font-semibold text-primary">
              {initials(displayName)}
            </span>
            <span className="hidden max-w-[120px] truncate text-[13px] font-medium lg:inline">
              {displayName}
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-subtle-foreground lg:inline" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="animate-scale-in absolute right-0 top-full z-50 mt-1.5 w-60 origin-top-right overflow-hidden rounded-lg surface-elevated p-1"
            >
              <div className="px-2.5 py-2">
                <p className="truncate text-[13px] font-medium">{displayName}</p>
                <p className="truncate text-2xs text-muted-foreground">{workspace?.name}</p>
              </div>
              <div className="my-1 h-px bg-border" />
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <SettingsIcon className="h-3.5 w-3.5" /> Settings
              </Link>
              <button
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-destructive transition-colors hover:bg-destructive/10"
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
