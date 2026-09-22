"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck, AlertTriangle } from "lucide-react";
import { AuthField } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import {
  AuthCanvas,
  AuthFrame,
  AuthHeadline,
  AuthPanel,
  AuthAnnotations,
  AuthArtwork,
  AuthProductFragment,
  AuthStatus,
} from "@/components/auth/auth-canvas";

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
      setSent(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCanvas>
      <AuthFrame>
        <div className="relative flex min-h-full flex-col lg:flex-row">
          {/* ---- LEFT / CANVAS ---- */}
          <div className="relative flex flex-1 flex-col justify-between p-8 md:p-12 lg:p-14">
            <AuthArtwork />

            <Link href="/" className="cinematic-frame mb-10 inline-flex items-center gap-2.5 self-start">
              <span className="text-[14px] font-semibold tracking-tight text-white/70">
                LeadForge
              </span>
            </Link>

            <div className="relative z-10 mt-auto">
              <AuthHeadline
                label="RECOVERY PROTOCOL"
                lines={["RESTORE", "ACCESS."]}
                support="Enter the email attached to your workspace."
              />
            </div>

            <AuthAnnotations
              items={[
                { label: "ACCESS_GATE", top: "18%", left: "5%", right: "auto", bottom: "auto", delay: 0.3 },
                { label: "AUTH_SESSION", top: "auto", left: "8%", right: "auto", bottom: "22%", delay: 0.38 },
                { label: "RESET_PROTOCOL", top: "auto", left: "auto", right: "5%", bottom: "18%", delay: 0.46 },
                { label: "OPERATOR_ID", top: "40%", left: "auto", right: "8%", bottom: "auto", delay: 0.54 },
                { label: "SECURE_CHANNEL", top: "60%", left: "3%", right: "auto", bottom: "auto", delay: 0.62 },
              ]}
            />

            <AuthProductFragment />
            <AuthStatus />
          </div>

          {/* ---- RIGHT: floating auth panel ---- */}
          <div className="flex flex-1 items-center justify-center p-6 md:p-10 lg:p-12">
            <AuthPanel>
              {sent ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-3 rounded border border-[hsl(82,100%,61%)]/20 bg-[hsl(82,100%,61%)]/[0.05] p-4">
                    <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(82,100%,61%)]" aria-hidden="true" />
                    <p className="text-[12px] leading-relaxed text-white/40">{sent}</p>
                  </div>
                  <p className="text-[11px] leading-relaxed text-white/20">
                    Nothing arrived? Check spam, then try again — requesting a new link replaces the previous one.
                  </p>
                  <button
                    onClick={() => setSent(null)}
                    className="flex h-10 w-full items-center justify-center rounded-[6px] border border-white/[0.06] bg-white/[0.02] text-[12px] font-medium text-white/40 transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-white/60"
                  >
                    Use a different address
                  </button>
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
                      className="flex items-start gap-2 rounded border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[11px] text-red-400/80"
                    >
                      <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || !email}
                    className="group mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-[6px] border border-white/[0.08] bg-white/[0.03] text-[13px] font-semibold text-white/80 transition-all duration-200 hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-white hover:shadow-[0_0_20px_-4px_hsl(82_100%_61%/0.15)] disabled:pointer-events-none disabled:opacity-40"
                  >
                    {submitting ? (
                      <>
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            background: "hsl(82 100% 61%)",
                            boxShadow: "0 0 6px hsl(82 100% 61% / 0.6)",
                            animation: "status-pulse 1.2s ease-in-out infinite",
                          }}
                        />
                        <span className="text-white/50">SENDING…</span>
                      </>
                    ) : (
                      <>
                        SEND RESET LINK
                        <ArrowLeft className="h-3.5 w-3.5 rotate-180 transition-transform duration-200 group-hover:-translate-x-1" />
                      </>
                    )}
                  </button>
                </form>
              )}

              <div className="mt-5 text-center text-[12px] text-white/25">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 font-medium text-white/50 transition-colors hover:text-white/70"
                >
                  <ArrowLeft className="h-3 w-3" />
                  RETURN TO LOGIN
                </Link>
              </div>
            </AuthPanel>
          </div>
        </div>
      </AuthFrame>
    </AuthCanvas>
  );
}
