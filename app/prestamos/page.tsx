"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Car,
  CreditCard,
  Radio,
  AlertTriangle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { MobileShell } from "@/components/layout/mobile-shell";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Prestamo {
  id: number;
  tipoRecurso?: string;
  recursoDescripcion?: string;
  fechaInicio?: string;
  fechaFinPrevista?: string;
  fechaDevolucionReal?: string;
  estado?: string;
  trabajadorId?: number;
  centroCosteNombre?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function recursoIcon(tipoRecurso?: string): React.ComponentType<{ className?: string }> {
  const tipo = (tipoRecurso ?? "").toLowerCase();
  if (tipo.includes("vehic")) return Car;
  if (tipo.includes("tarj")) return CreditCard;
  return Radio;
}

function urgenciaBadge(p: Prestamo): { label: string; cls: string } | null {
  const fechaFin = p.fechaFinPrevista;
  if (!fechaFin) return null;
  const now = Date.now();
  const end = new Date(fechaFin).getTime();
  const diffDays = (end - now) / 86_400_000;
  if (diffDays < 0) return { label: "Vencido", cls: "bg-destructive/15 text-destructive border-destructive/30" };
  if (diffDays <= 1) return { label: "Hoy", cls: "bg-primary/15 text-primary border-primary/30" };
  if (diffDays <= 3) return { label: `${Math.ceil(diffDays)}d`, cls: "bg-warning/15 text-warning border-warning/30" };
  return null;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrestamosPage() {
  const { data, isLoading, isError, refetch } = useQuery<Prestamo[]>({
    queryKey: ["mis-prestamos"],
    queryFn: () => apiClient.get<Prestamo[]>("/prestamos/mis-prestamos"),
    staleTime: 60_000,
  });

  const prestamos = data ?? [];
  const activos = prestamos.filter(
    (p) => !p.estado || p.estado.toLowerCase() === "activo" || p.estado.toLowerCase() === "vencido",
  );

  return (
    <MobileShell>
      <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Mis préstamos
          </h2>
          {activos.length > 0 && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
              {activos.length}
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Recursos que tienes asignados desde oficina. La gestión (alta, devolución, cierre) se hace desde el panel de administración.
        </p>

        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Cargando préstamos...</p>
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm font-medium text-destructive">Error al cargar los préstamos</p>
            <button
              onClick={() => refetch()}
              className="h-9 rounded-lg border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary"
            >
              Reintentar
            </button>
          </div>
        )}

        {!isLoading && !isError && activos.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-16 items-center justify-center rounded-full border border-border bg-card">
              <Car className="size-7 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">Sin préstamos activos</p>
            <p className="text-sm text-muted-foreground">
              No tienes préstamos asignados en este momento.
            </p>
          </div>
        )}

        {!isLoading && !isError && activos.length > 0 && (
          <div className="flex flex-col gap-3">
            {activos.map((p) => {
              const Icon = recursoIcon(p.tipoRecurso);
              const urgencia = urgenciaBadge(p);

              return (
                <div
                  key={p.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="size-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {p.recursoDescripcion ?? `Préstamo #${p.id}`}
                      </p>
                      {p.centroCosteNombre && (
                        <p className="text-xs text-muted-foreground truncate">
                          {p.centroCosteNombre}
                        </p>
                      )}
                    </div>
                    {urgencia && (
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                          urgencia.cls,
                        )}
                      >
                        {urgencia.cls.includes("destructive") && (
                          <AlertTriangle className="inline size-2.5 mr-0.5 -mt-0.5" />
                        )}
                        {urgencia.label}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                    <div>
                      <span className="text-muted-foreground/70">Desde </span>
                      <span className="font-medium text-foreground">{formatDate(p.fechaInicio)}</span>
                    </div>
                    {p.fechaFinPrevista && (
                      <div>
                        <span className="text-muted-foreground/70">Hasta </span>
                        <span className="font-medium text-foreground">{formatDate(p.fechaFinPrevista)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
