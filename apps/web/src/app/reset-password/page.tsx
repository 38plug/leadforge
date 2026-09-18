"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { AuthLayout, AuthField } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

interface AuthActionResponse {
  message: string;
}

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = confirmation.length > 0 && password !== confirmation;
  const tooShort = password.length > 0 && password.length < 8;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || mismatch || tooShort) return;

    setError(null);
    setSubmitting(true);
    try {
      await api.post<AuthActionResponse>(
        "/api/auth/reset-password",
        { token, new_password: password },
        { auth: false }
      );
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // A link with no token cannot be completed, and saying so immediately beats
  // letting someone type a password first.
  if (!token) {
    return (
      <AuthLayout
        title="This link is incomplete"
        subtitle="The reset link is missing its token — it may have been cut short by your email client."
        footer={
          <Link href="/forgot-password" className="font-medium text-foreground hover:text-primary">
            Request a new link
          </Link>
        }
      >
        <p className="rounded-md border border-warning/25 bg-warning/10 px-3 py-2.5 text-xs leading-relaxed text-warning">
          Copy the full address from the email, or request a fresh link.
        </p>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout
        title="Password changed"
        subtitle="You can sign in with your new password now."
        footer={null}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-lg border border-success/25 bg-success/[0.08] p-4">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              We also emailed you to confirm the change. If it wasn&apos;t you, reset the password
              again straight away.
            </p>
          </div>
          <Button size="lg" className="w-full" onClick={() => router.push("/login")}>
            Go to sign in
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="At least 8 characters. Pick something you don't use elsewhere."
      footer={
        <Link href="/login" className="font-medium text-foreground hover:text-primary">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <AuthField
          id="password"
          label="New password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
        />
        <div>
          <AuthField
            id="confirmation"
            label="Confirm new password"
            type="password"
            required
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="Type it again"
            aria-invalid={mismatch}
          />
          {mismatch && (
            <p className="mt-1.5 text-2xs text-destructive">These passwords don&apos;t match.</p>
          )}
          {tooShort && !mismatch && (
            <p className="mt-1.5 text-2xs text-subtle-foreground">
              {8 - password.length} more character{8 - password.length === 1 ? "" : "s"} needed.
            </p>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={submitting || mismatch || tooShort || !password || !confirmation}
          className="mt-1 w-full"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change password"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary for static rendering.
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
