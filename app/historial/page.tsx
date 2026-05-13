"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { MobileShell } from "@/components/layout/mobile-shell";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ticket {
  id: number;
  fechaHora?: string;
  fecha?: string;
  estacion?: string;
  importeTotal?: number;
  importe?: number;
  estadoCotejo?: string;
  estado?: string;
}

type Filter = "todos" | "pendiente" | "cotejado" | "incidencia";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} semanas`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function estadoLabel(estado: string): string {
  return { pendiente: "Pendiente", cotejado: "Cotejado", incidencia: "Incidencia" }[estado] ?? estado;
}

function estadoClass(estado: string): string {
  return (
    {
      pendiente: "bg-warning/15 text-warning border-warning/30",
      cotejado: "bg-success/15 text-success border-success/30",
      incidencia: "bg-destructive/15 text-destructive border-destructive/30",
    }[estado] ?? "bg-muted text-muted-foreground border-border"
  );
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "pendiente", label: "Pendiente" },
  { key: "cotejado", label: "Cotejado" },
  { key: "incidencia", label: "Incidencia" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistorialPage() {
  const [filter, setFilter] = useState<Filter>("todos");

  const { data, isLoading, isError, refetch, isFetching } = useQuery<Ticket[]>({
    queryKey: ["tickets"],
    queryFn: () => apiClient.get<Ticket[]>("/tickets"),
  });

  const tickets = (data ?? [])
    .slice()
    .sort((a, b) => {
      const da = new Date(a.fechaHora ?? a.fecha ?? 0).getTime();
      const db = new Date(b.fechaHora ?? b.fecha ?? 0).getTime();
      return db - da;
    })
    .filter((t) => {
      if (filter === "todos") return true;
      const estado = (t.estadoCotejo ?? t.estado ?? "pendiente").toLowerCase();
      return estado === filter;
    });

  return (
    <MobileShell>
      <div className="flex flex-col gap-4 pt-4 pb-6">

        {/* ── Filter chips ─────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="shrink-0 flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn("size-3", isFetching && "animate-spin")} />
            Actualizar
          </button>
        </div>

        {/* ── Content ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 px-4">
          {isLoading && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Cargando historial...</p>
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertCircle className="size-8 text-destructive" />
              <p className="text-sm font-medium text-destructive">Error al cargar el historial</p>
              <button
                onClick={() => refetch()}
                className="h-9 rounded-lg border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary"
              >
                Reintentar
              </button>
            </div>
          )}

          {!isLoading && !isError && tickets.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-full border border-border bg-card">
                <Receipt className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">Sin tickets</p>
              <p className="text-xs text-muted-foreground">
                {filter !== "todos" ? `No hay tickets con estado "${estadoLabel(filter)}"` : "No hay tickets registrados"}
              </p>
            </div>
          )}

          {!isLoading && !isError && tickets.map((t) => {
            const estado = (t.estadoCotejo ?? t.estado ?? "pendiente").toLowerCase();
            const fecha = t.fechaHora ?? t.fecha;
            const importe = t.importeTotal ?? t.importe;

            return (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
              >
                <Receipt className="size-4 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {t.estacion ?? "Sin estación"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fecha ? formatRelativeDate(fecha) : "—"}
                    {importe != null && ` · ${formatCurrency(importe)}`}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    estadoClass(estado),
                  )}
                >
                  {estadoLabel(estado)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </MobileShell>
  );
}
