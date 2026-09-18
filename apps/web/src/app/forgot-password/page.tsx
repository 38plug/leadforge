"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck, AlertTriangle } from "lucide-react";
import { AuthLayout, AuthField } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

interface AuthActionResponse {
  message: string;
  email_sent: boolean;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.post<AuthActionResponse>(
        "/api/auth/forgot-password",
        { email },
        { auth: false }
      );
      // The API answers identically whether or not the address is registered,
      // so this screen does too - saying "no such account" here would turn the
      // form into a way to discover who has one.
      setSent(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={sent ? "Check your email" : "Reset your password"}
      subtitle={
        sent
          ? "The link is valid for one hour and can only be used once."
          : "Enter the address you signed up with and we'll send you a link."
      }
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/[0.07] p-4">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-[13px] leading-relaxed text-muted-foreground">{sent}</p>
          </div>
          <p className="text-2xs leading-relaxed text-subtle-foreground">
            Nothing arrived? Check spam, then try again — requesting a new link replaces the previous one.
          </p>
          <Button variant="secondary" onClick={() => setSent(null)} className="w-full">
            Use a different address
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <AuthField
            id="email"
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@studio.com"
          />

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={submitting || !email} className="mt-1 w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
