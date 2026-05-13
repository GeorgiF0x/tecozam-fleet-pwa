"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, User, Lock, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Por favor ingresa tu usuario y contraseña");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Credenciales incorrectas";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-[400px] flex flex-col gap-8">

        {/* ── Brand ───────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-4">
          <div className="size-20 overflow-hidden rounded-2xl border-2 border-primary/20 shadow-lg">
            <Image
              src="/tecozam-logo.png"
              alt="Tecozam Fleet"
              width={80}
              height={80}
              className="object-cover size-full"
              priority
            />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-primary">Tecozam</span>{" "}
              <span className="text-foreground">Fleet</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Operarios · Sistema de control de gastos
            </p>
          </div>
        </div>

        {/* ── Card ────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl">
          <h2 className="mb-1 text-lg font-bold text-foreground">Iniciar sesión</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Accede con tus credenciales de empresa
          </p>

          {/* Error banner */}
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="username" className="text-sm font-semibold text-foreground">
                Usuario
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-3 size-4 text-muted-foreground pointer-events-none" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="nombre.apellido"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      passwordRef.current?.focus();
                    }
                  }}
                  className={cn(
                    "h-12 w-full rounded-lg border border-border bg-input pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground",
                    "outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20",
                  )}
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-semibold text-foreground">
                Contraseña
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 size-4 text-muted-foreground pointer-events-none" />
                <input
                  ref={passwordRef}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={cn(
                    "h-12 w-full rounded-lg border border-border bg-input pl-10 pr-12 text-sm text-foreground placeholder:text-muted-foreground",
                    "outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "mt-2 flex h-12 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/30",
                "transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
                "hover:bg-primary/90",
              )}
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {isLoading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        {/* ── Register link ────────────────────────────────────── */}
        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-semibold text-primary hover:underline">
            Regístrate
          </Link>
        </p>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/50">
          Tecozam Fleet © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
