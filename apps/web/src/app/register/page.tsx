"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  AuthCanvas,
  AuthFrame,
  AuthHeadline,
  AuthPanel,
  AuthAnnotations,
  AuthArtwork,
  AuthProductFragment,
  AuthStatus,
  AuthField,
} from "@/components/auth/auth-canvas";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await register(email, password, fullName, workspaceName);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCanvas>
      <AuthFrame>
        <div className="relative flex min-h-full flex-col lg:flex-row">
          {/* ---- LEFT / CANVAS: headline + artwork ---- */}
          <div className="relative flex flex-1 flex-col justify-between p-8 md:p-12 lg:p-14">
            <AuthArtwork />

            <Link href="/" className="cinematic-frame mb-10 inline-flex items-center gap-2.5 self-start">
              <span className="text-[14px] font-semibold tracking-tight text-white/70">
                LeadForge
              </span>
            </Link>

            <div className="relative z-10 mt-auto">
              <AuthHeadline
                label="INITIALIZE WORKSPACE"
                lines={["START", "FINDING", "CLIENTS."]}
                support="Create your LeadForge workspace."
              />
            </div>

            <AuthAnnotations
              items={[
                { label: "ACCESS_GATE", top: "18%", left: "5%", right: "auto", bottom: "auto", delay: 0.3 },
                { label: "AUTH_SESSION", top: "auto", left: "8%", right: "auto", bottom: "22%", delay: 0.38 },
                { label: "OPERATOR_ID", top: "35%", left: "auto", right: "5%", bottom: "auto", delay: 0.46 },
                { label: "ENGINE_STANDBY", top: "auto", left: "auto", right: "8%", bottom: "35%", delay: 0.54 },
                { label: "SECURE_CHANNEL", top: "60%", left: "3%", right: "auto", bottom: "auto", delay: 0.62 },
              ]}
            />

            <AuthProductFragment />
            <AuthStatus />
          </div>

          {/* ---- RIGHT: floating auth panel ---- */}
          <div className="flex flex-1 items-center justify-center p-6 md:p-10 lg:p-12">
            <AuthPanel>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <AuthField
                    id="full-name"
                    label="Your name"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Alex Moreira"
                  />
                  <AuthField
                    id="workspace"
                    label="Workspace name"
                    required
                    autoComplete="organization"
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    placeholder="Moreira Studio"
                  />
                </div>
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
                <AuthField
                  id="password"
                  label="Password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                />
                <AuthField
                  id="confirm-password"
                  label="Confirm password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your password"
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
                  disabled={submitting}
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
                      <span className="text-white/50">INITIALIZING…</span>
                    </>
                  ) : (
                    <>
                      CREATE WORKSPACE
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 text-center text-[12px] text-white/25">
                ALREADY INSIDE?{" "}
                <Link
                  href="/login"
                  className="font-medium text-white/50 transition-colors hover:text-white/70"
                >
                  LOG IN
                </Link>
              </div>
            </AuthPanel>
          </div>
        </div>
      </AuthFrame>
    </AuthCanvas>
  );
}
