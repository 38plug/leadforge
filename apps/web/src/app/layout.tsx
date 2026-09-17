import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "LeadForge — AI-Powered Client Acquisition",
  description: "Find businesses that are ready for a better website.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Browser extensions commonly mutate <html>/<body> before React hydrates
    // (injecting classes like "no-touch" or Grammarly's data-* attributes),
    // which React reports as a hydration mismatch even though the app itself
    // rendered correctly. suppressHydrationWarning only applies to *these two
    // elements' own attributes* — one level deep — so genuine mismatches
    // inside the app are still reported.
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
