const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WORKSPACE_KEY = "leadforge_workspace_id";

export class ApiError extends Error {
  status: number;
  code?: string;
  retryable?: boolean;

  constructor(status: number, message: string, code?: string, retryable?: boolean) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

let _redirecting = false;

export function getWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(WORKSPACE_KEY);
}

export function setWorkspaceId(id: string) {
  window.localStorage.setItem(WORKSPACE_KEY, id);
}

export function clearSession() {
  window.localStorage.removeItem(WORKSPACE_KEY);
}

interface RequestOptions extends RequestInit {
  auth?: boolean;
}

function extractErrorMessage(body: unknown): string {
  if (!body || typeof body !== "object") return "Request failed";
  const obj = body as Record<string, unknown>;
  const raw = obj.detail ?? obj.message;
  if (typeof raw === "string") return raw;
  // FastAPI validation errors: [{type, loc, msg, input, ctx}, ...]
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0] as Record<string, unknown>;
    if (first.msg) return String(first.msg);
  }
  return "Request failed — please try again";
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string>),
  };

  if (auth) {
    const workspaceId = getWorkspaceId();
    if (workspaceId) finalHeaders["X-Workspace-Id"] = workspaceId;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    credentials: "include",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await response.json().catch(() => null) : null;

  if (response.status === 401 && auth && !_redirecting) {
    _redirecting = true;
    clearSession();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new ApiError(401, "Session expired");
  }

  if (!response.ok) {
    throw new ApiError(response.status, extractErrorMessage(body), body?.code, body?.retryable);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, data?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
};
