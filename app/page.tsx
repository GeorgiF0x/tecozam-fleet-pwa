"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Camera,
  AlertTriangle,
  ArrowLeftRight,
  Receipt,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { MobileShell } from "@/components/layout/mobile-shell";
import { useAuth } from "@/providers/auth-provider";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alerta {
  id: number;
  tipo: string;
  mensaje: string;
  urgente?: boolean;
  createdAt?: string;
  fecha?: string;
}

interface TicketAPI {
  id: number;
  fechaHora?: string;
  fecha?: string;
  estacion?: string;
  importeTotal?: number;
  importe?: number;
  estadoCotejo?: string;
  estado?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

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
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function estadoLabel(estado: string): string {
  const map: Record<string, string> = {
    pendiente: "Pendiente",
    cotejado: "Cotejado",
    incidencia: "Incidencia",
  };
  return map[estado.toLowerCase()] ?? estado;
}

function estadoClass(estado: string): string {
  const map: Record<string, string> = {
    pendiente: "bg-warning/15 text-warning border-warning/30",
    cotejado: "bg-success/15 text-success border-success/30",
    incidencia: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return map[estado.toLowerCase()] ?? "bg-muted text-muted-foreground border-border";
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  href,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  highlight?: boolean;
}) {
  const content = (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm",
        highlight ? "border-primary/40" : "border-border",
      )}
    >
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-lg",
          highlight ? "bg-primary/20" : "bg-muted",
        )}
      >
        <Icon className={cn("size-4", highlight ? "text-primary" : "text-muted-foreground")} />
      </div>
      <span className={cn("text-2xl font-bold tabular-nums", highlight ? "text-primary" : "text-foreground")}>
        {value}
      </span>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="flex-1 min-w-0">
        {content}
      </Link>
    );
  }
  return <div className="flex-1 min-w-0">{content}</div>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user } = useAuth();

  const firstName =
    user?.trabajadorNombre?.split(" ")[0] ?? user?.username ?? "Conductor";

  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // ── Queries ──────────────────────────────────────────────────────────────

  // BILLS-09: NO disparar queries sin user — el guard del auth-provider redirige
  // a /login pero React renderiza esta página antes y dispararía 403 inmediatos.
  const isReady = !!user;

  const { data: alertas = [], isLoading: alertasLoading } = useQuery<Alerta[]>({
    queryKey: ["alertas-pendientes"],
    queryFn: () => apiClient.get<Alerta[]>("/alertas/mis-pendientes"),
    staleTime: 30_000,
    enabled: isReady,
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<TicketAPI[]>({
    queryKey: ["tickets-home"],
    queryFn: () => apiClient.get<TicketAPI[]>("/tickets/mis-tickets"),
    enabled: isReady,
  });

  const { data: prestamos = [] } = useQuery<{ id: number; estado: string }[]>({
    queryKey: ["prestamos-home"],
    queryFn: () => apiClient.get<{ id: number; estado: string }[]>("/prestamos/mis-prestamos"),
    enabled: isReady,
  });

  const prestamosActivos = prestamos.filter(
    (p) => p.estado?.toLowerCase() === "activo",
  ).length;

  const ticketsMes = tickets.filter((t) => {
    const d = t.fechaHora ?? t.fecha;
    if (!d) return false;
    const date = new Date(d);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  const topAlertas = alertas.slice(0, 3);
  const lastTickets = tickets.slice(0, 3);

  const isLoading = alertasLoading || ticketsLoading;

  return (
    <MobileShell>
      <div className="flex flex-col gap-5 px-4 pt-5 pb-4">

        {/* ── Greeting ───────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-0.5 text-sm capitalize text-muted-foreground">{today}</p>
        </div>

        {/* ── KPIs ───────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 h-24 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex gap-3">
            <KpiCard
              label="Alertas"
              value={alertas.length}
              icon={AlertTriangle}
              href="/alertas"
              highlight={alertas.length > 0}
            />
            <KpiCard
              label="Préstamos activos"
              value={prestamosActivos}
              icon={ArrowLeftRight}
              href="/prestamos"
            />
            <KpiCard
              label="Tickets este mes"
              value={ticketsMes}
              icon={Receipt}
              href="/historial"
            />
          </div>
        )}

        {/* ── Scan CTA ────────────────────────────────────────── */}
        <Link
          href="/escanear"
          className="flex items-center gap-4 rounded-2xl border border-primary/30 bg-primary/10 p-5 shadow-sm transition-all active:scale-[0.98] hover:bg-primary/15"
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary shadow-md shadow-primary/40">
            <Camera className="size-7 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-foreground">Escanear ticket</p>
            <p className="text-sm text-muted-foreground">Captura y registra un ticket</p>
          </div>
          <ChevronRight className="size-5 text-primary" />
        </Link>

        {/* ── Alertas urgentes ────────────────────────────────── */}
        {topAlertas.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Alertas urgentes
              </h2>
              <Link href="/alertas" className="text-xs font-medium text-primary hover:underline">
                Ver todas
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {topAlertas.map((alerta) => (
                <Link
                  key={alerta.id}
                  href="/alertas"
                  className="flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-sm transition-colors hover:bg-muted/30"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-2">
                      {alerta.mensaje}
                    </p>
                    {(alerta.createdAt ?? alerta.fecha) && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatRelativeDate(alerta.createdAt ?? alerta.fecha!)}
                      </p>
                    )}
                  </div>
                  {alerta.urgente && (
                    <span className="shrink-0 rounded-full border border-destructive/30 bg-destructive/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-destructive">
                      Urgente
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Últimos tickets ─────────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Últimos tickets
            </h2>
            <Link href="/historial" className="text-xs font-medium text-primary hover:underline">
              Ver todo
            </Link>
          </div>

          {ticketsLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : lastTickets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center">
              <Receipt className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Sin tickets registrados</p>
              <p className="text-xs text-muted-foreground/70">
                Usa el botón Escanear para registrar tu primer ticket
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {lastTickets.map((t) => {
                const estado = (t.estadoCotejo ?? t.estado ?? "pendiente").toLowerCase();
                const fecha = t.fechaHora ?? t.fecha;
                const importe = t.importeTotal ?? t.importe;
                return (
                  <Link
                    key={t.id}
                    href={`/historial`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm transition-colors hover:bg-muted/30"
                  >
                    <Receipt className="size-4 shrink-0 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {t.estacion ?? "Sin estación"}
                      </p>
                      {fecha && (
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeDate(fecha)}
                          {importe != null && ` · ${formatCurrency(importe)}`}
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                        estadoClass(estado),
                      )}
                    >
                      {estadoLabel(estado)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Refresh hint */}
        <div className="flex justify-center">
          <button
            className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="size-3" />
            Actualizar
          </button>
        </div>

      </div>
    </MobileShell>
  );
}
