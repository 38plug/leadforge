"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

type State = { status: "working" } | { status: "done" } | { status: "failed"; message: string };

function VerifyEmail() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<State>({ status: "working" });
  // React runs effects twice in development; the token is single-use, so a
  // second call would report failure on a confirmation that just succeeded.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!token) {
      setState({
        status: "failed",
        message: "This link is missing its token — it may have been cut short by your email client.",
      });
      return;
    }

    api
      .post("/api/auth/verify-email", { token }, { auth: false })
      .then(() => setState({ status: "done" }))
      .catch((err) =>
        setState({
          status: "failed",
          message:
            err instanceof ApiError ? err.message : "We couldn't confirm this address. Please try again.",
        })
      );
  }, [token]);

  if (state.status === "working") {
    return (
      <AuthLayout title="Confirming your email" subtitle="One moment." footer={null}>
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Checking your confirmation link...
        </div>
      </AuthLayout>
    );
  }

  if (state.status === "done") {
    return (
      <AuthLayout
        title="Email confirmed"
        subtitle="Thanks — we know we can reach you at this address."
        footer={null}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-lg border border-success/25 bg-success/[0.08] p-4">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Your workspace is ready to use.
            </p>
          </div>
          <Button asChild size="lg" className="w-full">
            <Link href="/dashboard">Go to your workspace</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="We couldn't confirm this link"
      subtitle="Confirmation links expire after three days and can only be used once."
      footer={
        <Link href="/login" className="font-medium text-foreground hover:text-primary">
          Back to sign in
        </Link>
      }
    >
      <div className="flex flex-col gap-4">
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-warning/25 bg-warning/10 px-3 py-2.5 text-xs leading-relaxed text-warning"
        >
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
        <p className="text-2xs leading-relaxed text-subtle-foreground">
          Sign in and request a new confirmation email from your settings — an unconfirmed address
          doesn&apos;t stop you using LeadForge.
        </p>
      </div>
    </AuthLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmail />
    </Suspense>
  );
}
