"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import {
  AuthCanvas,
  AuthFrame,
  AuthHeadline,
  AuthPanel,
  AuthAnnotations,
  AuthArtwork,
  AuthStatus,
} from "@/components/auth/auth-canvas";

type State = { status: "working" } | { status: "done" } | { status: "failed"; message: string };

function VerifyEmail() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<State>({ status: "working" });
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
                  label="EMAIL VERIFICATION"
                  lines={["CONFIRMING", "ADDRESS."]}
                  support="One moment."
                />
              </div>
              <AuthAnnotations
                items={[
                  { label: "VERIFY_PROTOCOL", top: "18%", left: "5%", right: "auto", bottom: "auto", delay: 0.3 },
                  { label: "SECURE_CHANNEL", top: "auto", left: "auto", right: "5%", bottom: "22%", delay: 0.4 },
                ]}
              />
              <AuthStatus />
            </div>
            <div className="flex flex-1 items-center justify-center p-6 md:p-10 lg:p-12">
              <AuthPanel>
                <div className="flex items-center gap-2.5 text-[12px] text-white/40" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Checking your confirmation link...
                </div>
              </AuthPanel>
            </div>
          </div>
        </AuthFrame>
      </AuthCanvas>
    );
  }

  if (state.status === "done") {
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
                  label="EMAIL VERIFIED"
                  lines={["ADDRESS", "CONFIRMED."]}
                  support="Thanks — we know we can reach you at this address."
                />
              </div>
              <AuthAnnotations
                items={[
                  { label: "ACCESS_GRANTED", top: "18%", left: "5%", right: "auto", bottom: "auto", delay: 0.3 },
                  { label: "SESSION_READY", top: "auto", left: "auto", right: "5%", bottom: "22%", delay: 0.4 },
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
                      Your workspace is ready to use.
                    </p>
                  </div>
                  <Link
                    href="/dashboard"
                    className="group flex h-10 w-full items-center justify-center gap-2 rounded-[6px] border border-white/[0.08] bg-white/[0.03] text-[13px] font-semibold text-white/80 transition-all duration-200 hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-white hover:shadow-[0_0_20px_-4px_hsl(82_100%_61%/0.15)]"
                  >
                    GO TO YOUR WORKSPACE
                  </Link>
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
                label="EMAIL VERIFICATION"
                lines={["LINK", "EXPIRED."]}
                support="Confirmation links expire after three days and can only be used once."
              />
            </div>
            <AuthAnnotations
              items={[
                { label: "LINK_EXPIRED", top: "18%", left: "5%", right: "auto", bottom: "auto", delay: 0.3 },
                { label: "RESET_PROTOCOL", top: "auto", left: "auto", right: "5%", bottom: "22%", delay: 0.4 },
              ]}
            />
            <AuthStatus />
          </div>
          <div className="flex flex-1 items-center justify-center p-6 md:p-10 lg:p-12">
            <AuthPanel>
              <div className="flex flex-col gap-4">
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-amber-400/80"
                >
                  <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
                  {state.message}
                </p>
                <p className="text-[11px] leading-relaxed text-white/20">
                  Sign in and request a new confirmation email from your settings — an unconfirmed address
                  doesn&apos;t stop you using LeadForge.
                </p>
                <Link
                  href="/login"
                  className="group mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-[6px] border border-white/[0.08] bg-white/[0.03] text-[13px] font-semibold text-white/80 transition-all duration-200 hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-white"
                >
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

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmail />
    </Suspense>
  );
}
