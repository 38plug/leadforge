"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowLeft, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
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

  if (!token) {
    return (
      <AuthCanvas>
        <AuthFrame>
          <div className="relative flex min-h-full flex-col lg:flex-row">
            <div className="relative flex flex-1 flex-col justify-between p-8 md:p-12 lg:p-14">
              <AuthArtwork />
              <Link href="/" className="cinematic-frame mb-10 inline-flex items-center gap-2.5 self-start">
                <span className="text-[14px] font-semibold tracking-tight text-white/70">LeadForge</span>
              </Link>
              <div className="relative z-10 mt-auto">
                <AuthHeadline
                  label="RESET PROTOCOL"
                  lines={["LINK", "INCOMPLETE."]}
                  support="The reset link is missing its token — it may have been cut short by your email client."
                />
              </div>
              <AuthAnnotations
                items={[
                  { label: "RESET_PROTOCOL", top: "18%", left: "5%", right: "auto", bottom: "auto", delay: 0.3 },
                  { label: "LINK_EXPIRED", top: "auto", left: "auto", right: "5%", bottom: "22%", delay: 0.4 },
                ]}
              />
              <AuthStatus />
            </div>
            <div className="flex flex-1 items-center justify-center p-6 md:p-10 lg:p-12">
              <AuthPanel>
                <div className="rounded border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-amber-400/80">
                  Copy the full address from the email, or request a fresh link.
                </div>
                <div className="mt-4 text-center text-[12px] text-white/25">
                  <Link href="/forgot-password" className="font-medium text-white/50 transition-colors hover:text-white/70">
                    REQUEST A NEW LINK
                  </Link>
                </div>
              </AuthPanel>
            </div>
          </div>
        </AuthFrame>
      </AuthCanvas>
    );
  }

  if (done) {
    return (
      <AuthCanvas>
        <AuthFrame>
          <div className="relative flex min-h-full flex-col lg:flex-row">
            <div className="relative flex flex-1 flex-col justify-between p-8 md:p-12 lg:p-14">
              <AuthArtwork />
              <Link href="/" className="cinematic-frame mb-10 inline-flex items-center gap-2.5 self-start">
                <span className="text-[14px] font-semibold tracking-tight text-white/70">LeadForge</span>
              </Link>
              <div className="relative z-10 mt-auto">
                <AuthHeadline
                  label="ACCESS RESTORED"
                  lines={["PASSWORD", "CHANGED."]}
                  support="You can sign in with your new password now."
                />
              </div>
              <AuthAnnotations
                items={[
                  { label: "ACCESS_RESTORED", top: "18%", left: "5%", right: "auto", bottom: "auto", delay: 0.3 },
                  { label: "SECURE_CHANNEL", top: "auto", left: "auto", right: "5%", bottom: "22%", delay: 0.4 },
                ]}
              />
              <AuthStatus />
            </div>
            <div className="flex flex-1 items-center justify-center p-6 md:p-10 lg:p-12">
              <AuthPanel>
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-3 rounded border border-[hsl(152,60%,48%)]/20 bg-[hsl(152,60%,48%)]/[0.06] p-4">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(152,60%,48%)]" aria-hidden="true" />
                    <p className="text-[12px] leading-relaxed text-white/40">
                      We also emailed you to confirm the change. If it wasn&apos;t you, reset the password
                      again straight away.
                    </p>
                  </div>
                  <button
                    onClick={() => router.push("/login")}
                    className="group flex h-10 w-full items-center justify-center gap-2 rounded-[6px] border border-white/[0.08] bg-white/[0.03] text-[13px] font-semibold text-white/80 transition-all duration-200 hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-white hover:shadow-[0_0_20px_-4px_hsl(82_100%_61%/0.15)]"
                  >
                    GO TO SIGN IN
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                </div>
              </AuthPanel>
            </div>
          </div>
        </AuthFrame>
      </AuthCanvas>
    );
  }

  return (
    <AuthCanvas>
      <AuthFrame>
        <div className="relative flex min-h-full flex-col lg:flex-row">
          <div className="relative flex flex-1 flex-col justify-between p-8 md:p-12 lg:p-14">
            <AuthArtwork />
            <Link href="/" className="cinematic-frame mb-10 inline-flex items-center gap-2.5 self-start">
              <span className="text-[14px] font-semibold tracking-tight text-white/70">LeadForge</span>
            </Link>
            <div className="relative z-10 mt-auto">
              <AuthHeadline
                label="RESET PROTOCOL"
                lines={["RESTORE", "ACCESS."]}
                support="At least 8 characters. Pick something you don't use elsewhere."
              />
            </div>
            <AuthAnnotations
              items={[
                { label: "RESET_PROTOCOL", top: "18%", left: "5%", right: "auto", bottom: "auto", delay: 0.3 },
                { label: "AUTH_SESSION", top: "auto", left: "8%", right: "auto", bottom: "22%", delay: 0.38 },
                { label: "SECURE_CHANNEL", top: "60%", left: "3%", right: "auto", bottom: "auto", delay: 0.46 },
              ]}
            />
            <AuthProductFragment />
            <AuthStatus />
          </div>
          <div className="flex flex-1 items-center justify-center p-6 md:p-10 lg:p-12">
            <AuthPanel>
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
                    <p className="mt-1.5 text-[11px] text-red-400/80">These passwords don&apos;t match.</p>
                  )}
                  {tooShort && !mismatch && (
                    <p className="mt-1.5 text-[11px] text-white/25">
                      {8 - password.length} more character{8 - password.length === 1 ? "" : "s"} needed.
                    </p>
                  )}
                </div>

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
                  disabled={submitting || mismatch || tooShort || !password || !confirmation}
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
                      <span className="text-white/50">UPDATING…</span>
                    </>
                  ) : (
                    <>
                      CHANGE PASSWORD
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>

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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
