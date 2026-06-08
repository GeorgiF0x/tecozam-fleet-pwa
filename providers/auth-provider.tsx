"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiClient, tokens, ApiError } from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  username: string;
  rol: string;
  trabajadorId?: number;
  trabajadorNombre?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PUBLIC_PATHS = ["/login"];

const ALLOWED_ROLES = [
  "ROLE_CAMPO",
  "CAMPO",
  "ROLE_CONSULTA",
  "CONSULTA",
];

function isAllowedRole(rol: string): boolean {
  return ALLOWED_ROLES.some((r) => r === rol.toUpperCase());
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  username: string;
  rol: string;
  expiresIn?: number;
}

interface MeResponse {
  username: string;
  rol: string;
  trabajadorId?: number;
  trabajador?: {
    id?: number;
    nombre?: string;
    apellidos?: string;
    nombreCompleto?: string;
  };
  nombre?: string;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Session restore on mount ──────────────────────────────────────────────

  const restoreSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const refreshToken = tokens.refresh;
      if (!refreshToken) {
        setUser(null);
        return;
      }

      // Try to get user info (will auto-refresh via api-client if needed)
      const me = await apiClient.get<MeResponse>("/auth/campo/me");

      const trabajadorNombre =
        me.trabajador?.nombreCompleto ??
        ([me.trabajador?.nombre, me.trabajador?.apellidos].filter(Boolean).join(" ") || me.nombre);

      setUser({
        username: me.username,
        rol: me.rol,
        trabajadorId: me.trabajadorId ?? me.trabajador?.id,
        trabajadorNombre,
      });
    } catch {
      tokens.clear();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Route guard ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (isLoading) return;
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    if (!user && !isPublic) {
      router.replace("/login");
    }
  }, [isLoading, user, pathname, router]);

  // ── Login ─────────────────────────────────────────────────────────────────

  const login = useCallback(
    async (username: string, password: string) => {
      const data = await apiClient.post<LoginResponse>("/auth/campo/login", {
        username,
        password,
      });

      if (!isAllowedRole(data.rol)) {
        throw new ApiError(
          403,
          "Esta cuenta es para operarios. Accede desde bills.z-innova.com",
        );
      }

      tokens.set(data.accessToken, data.refreshToken);

      // Fetch full user profile
      let me: MeResponse;
      try {
        me = await apiClient.get<MeResponse>("/auth/campo/me");
      } catch {
        me = { username: data.username, rol: data.rol };
      }

      const trabajadorNombre =
        me.trabajador?.nombreCompleto ??
        ([me.trabajador?.nombre, me.trabajador?.apellidos].filter(Boolean).join(" ") || me.nombre);

      setUser({
        username: me.username,
        rol: me.rol,
        trabajadorId: me.trabajadorId ?? me.trabajador?.id,
        trabajadorNombre,
      });

      router.replace("/");
    },
    [router],
  );

  // ── Logout ────────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    tokens.clear();
    setUser(null);
    router.replace("/login");
  }, [router]);

  // ── Value ─────────────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
