"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { LogoMark } from "@/components/brand/logo-mark";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#081410] px-4 py-10 text-white">
      <div
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[500px] w-[800px] -translate-x-1/2 rounded-full opacity-50 blur-[120px]"
        style={{ background: "radial-gradient(circle, hsl(var(--glow-strong) / 0.6), transparent 65%)" }}
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <LogoMark size={32} />
          <span className="text-base font-semibold">LeadForge</span>
        </Link>
        <h1 className="text-center text-lg font-semibold">Create your workspace</h1>
        <p className="mt-1 text-center text-[13px] text-white/50">Start finding leads in minutes — free</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fullName" className="text-xs font-medium text-white/70">Your name</label>
            <input
              id="fullName"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm outline-none focus:border-white/30"
              placeholder="Jordan Reyes"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="workspaceName" className="text-xs font-medium text-white/70">Workspace / agency name</label>
            <input
              id="workspaceName"
              required
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm outline-none focus:border-white/30"
              placeholder="Acme Web Studio"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium text-white/70">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm outline-none focus:border-white/30"
              placeholder="you@studio.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium text-white/70">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm outline-none focus:border-white/30"
              placeholder="At least 8 characters"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-gradient-brand text-sm font-bold text-brand-ink transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create account <ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>

        <p className="mt-6 text-center text-[13px] text-white/50">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-white hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
