"use client";

import { LogOut } from "lucide-react";
import { MobileShell } from "@/components/layout/mobile-shell";
import { useAuth } from "@/providers/auth-provider";

const VERSION = "1.0.0";

export default function PerfilPage() {
  const { user, logout } = useAuth();

  const initials = user?.trabajadorNombre
    ? user.trabajadorNombre
        .split(" ")
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : user?.username?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <MobileShell>
      <div className="flex flex-col gap-5 px-4 pt-5 pb-6">

        {/* ── Avatar ──────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="flex size-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/30">
            {initials}
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">
              {user?.trabajadorNombre ?? user?.username ?? "Operario"}
            </p>
            <p className="text-sm text-muted-foreground">@{user?.username}</p>
          </div>
        </div>

        {/* ── Data card ───────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <DataRow label="Usuario" value={`@${user?.username ?? "—"}`} />
          {user?.trabajadorNombre && (
            <DataRow label="Nombre completo" value={user.trabajadorNombre} />
          )}
          {user?.trabajadorId && (
            <DataRow label="ID operario" value={String(user.trabajadorId)} mono />
          )}
          <DataRow label="Rol" value={user?.rol ?? "—"} />
        </div>

        {/* ── Logout ──────────────────────────────────────────── */}
        <button
          onClick={logout}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 text-sm font-semibold text-destructive transition-all hover:bg-destructive/20 active:scale-[0.98]"
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </button>

        {/* ── Version ─────────────────────────────────────────── */}
        <p className="text-center text-xs text-muted-foreground/50">
          Tecozam Fleet PWA v{VERSION}
        </p>
      </div>
    </MobileShell>
  );
}

function DataRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border last:border-0 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm font-semibold text-foreground ${mono ? "font-mono tabular-nums" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
