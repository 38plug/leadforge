"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  // Keying on the route replays the entrance on every navigation, so moving
  // between sections reads as a transition rather than an instant swap.
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div key={pathname} className="animate-rise-in mx-auto w-full max-w-[1600px] px-6 py-6">{children}</div>
          <footer className="border-t border-border px-6 py-3 text-center text-[11px] text-muted-foreground">
            Business data ©{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
              OpenStreetMap contributors
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
