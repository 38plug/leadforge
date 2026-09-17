"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError, clearToken, getToken, setToken, setWorkspaceId } from "@/lib/api";
import type { ApiUser, ApiWorkspace, AuthResponse, MeResponse } from "@/types/api";

interface AuthContextValue {
  user: ApiUser | null;
  workspace: ApiWorkspace | null;
  loading: boolean;
  error: string | null;
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
    <AuthContext.Provider value={{ user, workspace, loading, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
