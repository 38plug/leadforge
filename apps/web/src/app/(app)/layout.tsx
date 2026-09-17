import { AppShell } from "@/components/layout/app-shell";
import { RequireAuth } from "@/components/auth/require-auth";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
      <OnboardingGate />
    </RequireAuth>
  );
}
