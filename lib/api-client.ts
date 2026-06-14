// ─── API Client ───────────────────────────────────────────────────────────────
// Thin fetch wrapper with auto-auth, token refresh and typed errors.

import { toast } from "sonner";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://bills-api.z-innova.com";

// ── Error class ───────────────────────────────────────────────────────────────
// .message es SIEMPRE legible para no-tecnicos (apto para mostrar en toasts).
// .technicalMessage preserva el original del backend/HTTP para depurar.
// .status es el codigo HTTP (0 = fallo de red, 1 = error desconocido).

export class ApiError extends Error {
  public readonly technicalMessage: string;
  constructor(
    public readonly status: number,
    technicalMessage: string,
  ) {
    super(friendlyMessage(status, technicalMessage));
    this.name = "ApiError";
    this.technicalMessage = technicalMessage;
  }
}

// Traduce un (status, mensaje del backend) en un mensaje apto para un usuario
// no tecnico. Si el backend ya manda un mensaje de negocio razonable (corto
// y sin trazas), lo respeta. Si no, mapea por codigo HTTP.
function friendlyMessage(status: number, backendMessage: string): string {
  const msg = (backendMessage ?? "").trim();
  const looksTechnical =
    !msg ||
    msg.length > 200 ||
    msg.startsWith("HTTP ") ||
    /exception|stacktrace|nullpointer|sqlexception/i.test(msg) ||
    /^error\s+interno/i.test(msg) ||
    /^internal\s+server\s+error/i.test(msg);

  if (!looksTechnical) return msg;

  if (status === 0) return "Sin conexion. Comprueba tu internet e intentalo de nuevo.";
  if (status === 400) return "Hay un dato incorrecto. Revisa el formulario e intentalo otra vez.";
  if (status === 401) return "Tu sesion ha caducado. Vuelve a iniciar sesion.";
  if (status === 403) return "No tienes permisos para hacer esto.";
  if (status === 404) return "No encontramos lo que buscabas.";
  if (status === 409) return "Ya existe un registro con esos datos.";
  if (status === 413) return "El archivo es demasiado grande.";
  if (status === 422) return "Algunos datos no son validos. Revisalos.";
  if (status === 429) return "Estamos recibiendo demasiadas peticiones. Espera unos segundos.";
  if (status >= 500) return "Algo ha fallado en el servidor. Intentalo de nuevo en unos segundos.";

  return "Ha ocurrido un error inesperado. Si persiste, avisa al administrador.";
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
  // Llegamos aqui solo cuando tras un refresh el backend SIGUE devolviendo 403
  // (ver request()). Esto significa que el usuario esta autenticado pero
  // realmente no tiene permiso para esta accion — no es un problema de token.
  // En una PWA donde el operario solo ve cosas que le tocan esto deberia ser
  // raro, pero por si acaso mostramos algo no-tecnico.
  toast.error("Esta accion no esta disponible", {
    description:
      message && message.length < 160 && !/forbidden|access denied/i.test(message)
        ? message
        : "Tu cuenta no tiene acceso a esta opcion. Si crees que es un error, avisa a tu administrador.",
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

  // Capturamos el fallo de red para devolver siempre un ApiError. Sin esto
  // el componente recibiria un TypeError opaco ("Failed to fetch") y el
  // toast mostraria texto tecnico.
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (networkErr) {
    throw new ApiError(0, networkErr instanceof Error ? networkErr.message : "Network error");
  }

  // 401 Y 403 disparan refresh. Spring Security devuelve 403 (no 401) cuando
  // el JWT esta caducado o invalido porque el JwtFilter marca el contexto como
  // anonimo y el AuthorizationFilter responde "Forbidden" al acceder a un
  // endpoint protegido sin auth. Para el usuario es indistinguible de un
  // token expirado normal — si no refrescamos, le aparece "Sin permisos"
  // cuando en realidad es "sesion expirada".
  // Si tras el refresh el backend SIGUE devolviendo 403 (retry=false), ahi
  // si es un 403 legitimo de permisos y lo tratamos como tal.
  if ((res.status === 401 || res.status === 403) && retry) {
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
    // 403 con retry=false = ya intentamos refresh y sigue forbidden.
    // Es un permiso real, no un token caducado.
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
