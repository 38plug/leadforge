"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError, clearToken, getToken, setToken, setWorkspaceId } from "@/lib/api";
import type { ApiUser, ApiWorkspace, AuthResponse, MeResponse } from "@/types/api";

interface AuthContextValue {
  user: ApiUser | null;
  workspace: ApiWorkspace | null;
  loading: boolean;
  error: string | null;
  /** Re-reads the session from the server. The plan can change without this
   *  browser doing anything - an admin comps an account, or a Stripe webhook
   *  lands - so the cached copy has to be refreshable. */
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, workspaceName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [workspace, setWorkspace] = useState<ApiWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    // Deliberately does not set `loading` back to true: a background refresh
    // must not drop the whole application into its skeleton state while the
    // user is reading it.
    try {
      const me = await api.get<MeResponse>("/api/auth/me");
      setUser(me.user);
      const active = me.workspaces[0] ?? null;
      setWorkspace(active);
      if (active) setWorkspaceId(active.id);
    } catch {
      clearToken();
      setUser(null);
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // The workspace was loaded once at mount, which meant a plan changed by an
  // admin or by a Stripe webhook kept showing the old value until the tab was
  // reloaded - and someone who had just been upgraded saw FREE. Re-reading
  // when the tab regains focus covers the realistic case: the change happens
  // while the user is looking somewhere else.
  useEffect(() => {
    function onFocus() {
      if (getToken()) void loadSession();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [loadSession]);

  const applyAuthResponse = (response: AuthResponse) => {
    setToken(response.access_token);
    setWorkspaceId(response.workspace.id);
    setUser(response.user);
    setWorkspace(response.workspace);
  };

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const response = await api.post<AuthResponse>("/api/auth/login", { email, password }, { auth: false });
      applyAuthResponse(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to log in");
      throw err;
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, fullName: string, workspaceName: string) => {
      setError(null);
      try {
        const response = await api.post<AuthResponse>(
          "/api/auth/register",
          { email, password, full_name: fullName, workspace_name: workspaceName },
          { auth: false }
        );
        applyAuthResponse(response);
        try {
          // Consumed once by OnboardingGate to play the welcome animation.
          sessionStorage.setItem("leadforge.just-registered", "1");
        } catch {
          // Storage unavailable — the user just skips straight to the tour.
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Unable to create account");
        throw err;
      }
    },
    []
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setWorkspace(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, workspace, loading, error, refresh: loadSession, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
