// ─── API Client ───────────────────────────────────────────────────────────────
// Thin fetch wrapper with auto-auth, token refresh and typed errors.

import { toast } from "sonner";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://bills-api.z-innova.com";

// ── Error class ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Token helpers (localStorage — SSR safe, persiste al cerrar la PWA) ───────
// FLEET-03: cambiamos de sessionStorage a localStorage para que la sesion
// sobreviva al cierre y reapertura de la aplicacion. El access token expira en
// 30 min y se renueva via /auth/campo/refresh; el refresh token vive 7 dias.

function getToken(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function setToken(key: string, value: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, value);
}

function removeToken(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}

export const tokens = {
  get access() {
    return getToken("accessToken");
  },
  get refresh() {
    return getToken("refreshToken");
  },
  set(access: string, refresh: string) {
    setToken("accessToken", access);
    setToken("refreshToken", refresh);
  },
  clear() {
    removeToken("accessToken");
    removeToken("refreshToken");
  },
};

// ── Normalise path ─────────────────────────────────────────────────────────────

function normalisePath(path: string): string {
  if (path.startsWith("/api") || path.startsWith("api")) return path;
  return `/api${path.startsWith("/") ? path : `/${path}`}`;
}

// ── Redirect helper ────────────────────────────────────────────────────────────

let sessionExpiredNotified = false;

function isOnLoginPath(): boolean {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/login");
}

function redirectToLogin(): never {
  tokens.clear();
  if (typeof window !== "undefined") {
    if (!sessionExpiredNotified && !isOnLoginPath()) {
      sessionExpiredNotified = true;
      toast.error("Tu sesion ha expirado", {
        description: "Vuelve a iniciar sesion para continuar.",
        duration: 6000,
      });
    }
    window.location.href = "/login";
  }
  throw new ApiError(401, "Session expired");
}

function notifyForbidden(message: string) {
  // FLEET-02/03/BILLS-09: silenciamos el toast cuando ya estamos en /login,
  // porque las queries autenticadas pueden dispararse en background mientras
  // el usuario aun no ha iniciado sesion y mostrarian errores irrelevantes.
  if (isOnLoginPath()) return;
  toast.error("Sin permisos", {
    description:
      message && message.length < 160
        ? message
        : "No tienes permisos para esta accion.",
    duration: 5000,
  });
}

// ── Token refresh ──────────────────────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  const refreshToken = tokens.refresh;
  if (!refreshToken) return redirectToLogin();

  refreshPromise = fetch(`${BASE_URL}/api/auth/campo/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) return redirectToLogin();
      const data = await res.json();
      const newAccess: string = data.accessToken;
      const newRefresh: string = data.refreshToken ?? refreshToken;
      tokens.set(newAccess, newRefresh);
      return newAccess;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

// ── Core fetch ────────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  init: RequestInit,
  retry = true,
): Promise<T> {
  const url = `${BASE_URL}${normalisePath(path)}`;
  const accessToken = tokens.access;

  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const res = await fetch(url, { ...init, headers });

  if (res.status === 401 && retry) {
    // Attempt token refresh once
    try {
      const newToken = await refreshAccessToken();
      headers.set("Authorization", `Bearer ${newToken}`);
      return request<T>(path, { ...init, headers }, false);
    } catch {
      return redirectToLogin();
    }
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.message ?? body?.error ?? message;
    } catch {
      // ignore parse errors
    }
    if (res.status === 403) {
      notifyForbidden(message);
    }
    throw new ApiError(res.status, message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ── Public client ─────────────────────────────────────────────────────────────

export const apiClient = {
  get<T>(path: string): Promise<T> {
    return request<T>(path, { method: "GET" });
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
  },

  /** Multipart upload — caller builds the FormData. */
  upload<T>(path: string, formData: FormData): Promise<T> {
    // Do NOT set Content-Type — browser must set the boundary automatically.
    return request<T>(path, { method: "POST", body: formData });
  },
};
