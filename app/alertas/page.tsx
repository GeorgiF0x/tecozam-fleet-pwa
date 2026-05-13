"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Info,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { MobileShell } from "@/components/layout/mobile-shell";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alerta {
  id: number;
  tipo?: string;
  mensaje?: string;
  descripcion?: string;
  urgente?: boolean;
  prioridad?: "ALTA" | "MEDIA" | "BAJA";
  createdAt?: string;
  fecha?: string;
  fechaCreacion?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function alertaIcon(alerta: Alerta): React.ComponentType<{ className?: string }> {
  const tipo = (alerta.tipo ?? "").toLowerCase();
  if (alerta.urgente || alerta.prioridad === "ALTA" || tipo.includes("urgent")) return AlertTriangle;
  if (tipo.includes("info") || tipo.includes("aviso")) return Info;
  return AlertCircle;
}

// alertaClass kept for reference but we use inline logic in render
function _alertaClass(alerta: Alerta): string {
  if (alerta.urgente || alerta.prioridad === "ALTA") return "destructive";
  if (alerta.prioridad === "MEDIA") return "medium";
  return "normal";
}

function badgeClass(alerta: Alerta): string {
  if (alerta.urgente || alerta.prioridad === "ALTA") return "bg-destructive/15 text-destructive border-destructive/30";
  if (alerta.prioridad === "MEDIA") return "bg-warning/15 text-warning border-warning/30";
  return "bg-muted text-muted-foreground border-border";
}

function badgeLabel(alerta: Alerta): string {
  if (alerta.urgente || alerta.prioridad === "ALTA") return "Urgente";
  if (alerta.prioridad === "MEDIA") return "Media";
  return "Normal";
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function sortAlertas(alertas: Alerta[]): Alerta[] {
  const priority = (a: Alerta): number => {
    if (a.urgente || a.prioridad === "ALTA") return 0;
    if (a.prioridad === "MEDIA") return 1;
    return 2;
  };
  return [...alertas].sort((a, b) => priority(a) - priority(b));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlertasPage() {
  const { data, isLoading, isError, refetch } = useQuery<Alerta[]>({
    queryKey: ["alertas-pendientes"],
    queryFn: () => apiClient.get<Alerta[]>("/alertas/pendientes"),
    staleTime: 30_000,
  });

  const alertas = sortAlertas(data ?? []);

  return (
    <MobileShell>
      <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Alertas pendientes
          </h2>
          {alertas.length > 0 && (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
              {alertas.length}
            </span>
          )}
        </div>

        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Cargando alertas...</p>
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm font-medium text-destructive">Error al cargar las alertas</p>
            <button
              onClick={() => refetch()}
              className="h-9 rounded-lg border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary"
            >
              Reintentar
            </button>
          </div>
        )}

        {!isLoading && !isError && alertas.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-16 items-center justify-center rounded-full border border-success/30 bg-success/10">
              <CheckCircle className="size-7 text-success" />
            </div>
            <p className="text-base font-semibold text-foreground">Sin alertas pendientes</p>
            <p className="text-sm text-muted-foreground">Todo está en orden.</p>
          </div>
        )}

        {!isLoading && !isError && alertas.length > 0 && (
          <div className="flex flex-col gap-2">
            {alertas.map((alerta) => {
              const Icon = alertaIcon(alerta);
              const fecha = alerta.createdAt ?? alerta.fecha ?? alerta.fechaCreacion;
              const mensaje = alerta.mensaje ?? alerta.descripcion ?? "Sin descripción";

              const isUrgent = alerta.urgente || alerta.prioridad === "ALTA";
              const isMedium = !isUrgent && alerta.prioridad === "MEDIA";

              return (
                <div
                  key={alerta.id}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-4 py-3 shadow-sm",
                    isUrgent ? "border-destructive/20 bg-destructive/5" :
                    isMedium ? "border-warning/20 bg-warning/5" :
                    "border-border bg-card",
                  )}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      isUrgent ? "text-destructive" :
                      isMedium ? "text-warning" :
                      "text-primary",
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{mensaje}</p>
                    {fecha && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(fecha)}</p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      badgeClass(alerta),
                    )}
                  >
                    {badgeLabel(alerta)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
