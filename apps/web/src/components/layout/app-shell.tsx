"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/ui/command-palette";

/**
 * The persistent frame every authenticated screen renders inside.
 *
 * Wrapped in AppFrame: thin outer border, rounded corners, sits inside
 * viewport with 12-20px inset. Sidebar becomes a narrow instrument rail.
 * Topbar becomes an ultra-thin command bar.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

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
    <div className="app-frame flex h-screen w-full flex-col overflow-hidden">
      {/* Command bar — replaces the thick topbar */}
      <Topbar onOpenNav={() => setNavOpen(true)} />

      <div className="flex min-h-0 flex-1">
        {/* Desktop: instrument rail sidebar */}
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
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <div className="relative h-full w-[260px]">
              <Sidebar onNavigate={() => setNavOpen(false)} expanded />
            </div>
          </div>
        )}

        {/* Content area */}
        <main className="flex-1 overflow-y-auto scrollbar-none">
          <div key={pathname} className="dash-enter mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6">
            {children}
          </div>
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}
