"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/ui/command-palette";

/**
 * The persistent frame every authenticated screen renders inside.
 *
 * On desktop the sidebar is part of the layout; below md it becomes a drawer,
 * because a 248px rail on a phone leaves nothing for the data. The content
 * area is keyed on the route so each navigation replays the entrance and
 * moving between sections reads as a transition rather than a hard swap.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  // Route changes close the drawer; without this it stays open over the page
  // the user just navigated to.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setNavOpen(false);
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
            className="animate-fade-in absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="animate-slide-in-left relative h-full w-[260px]">
            <Sidebar onNavigate={() => setNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenNav={() => setNavOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div key={pathname} className="animate-rise-in mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
            {children}
          </div>
          <footer className="border-t border-border px-6 py-3 text-center text-2xs text-subtle-foreground">
            Business data ©{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              OpenStreetMap contributors
            </a>
          </footer>
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}
