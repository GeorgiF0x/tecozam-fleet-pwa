"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Receipt,
  Loader2,
  AlertCircle,
  RefreshCw,
  Pencil,
  Trash2,
  ImageOff,
} from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/layout/mobile-shell";
import { apiClient, ApiError } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoGasto = "COMBUSTIBLE" | "PEAJE";

interface TicketLinea {
  fotoUrl?: string | null;
}

interface Ticket {
  id: number;
  fechaHora?: string;
  fecha?: string;
  estacion?: string;
  importeTotal?: number;
  importe?: number;
  litros?: number | null;
  precioLitro?: number | null;
  tipoGasto?: TipoGasto;
  estadoCotejo?: string;
  estado?: string;
  lineas?: TicketLinea[];
}

// Edicion propia — mismos campos que ActualizarTicketPropioRequest (backend).
interface EditForm {
  estacion: string;
  fechaHora: string;
  importeTotal: string;
  litros: string;
  precioLitro: string;
  tipoGasto: TipoGasto;
}

function ticketToEditForm(t: Ticket): EditForm {
  return {
    estacion: t.estacion ?? "",
    fechaHora: t.fechaHora ?? t.fecha ?? "",
    importeTotal: String(t.importeTotal ?? t.importe ?? ""),
    litros: t.litros != null ? String(t.litros) : "",
    precioLitro: t.precioLitro != null ? String(t.precioLitro) : "",
    tipoGasto: t.tipoGasto ?? "COMBUSTIBLE",
  };
}

type Filter = "todos" | "pendiente" | "cotejado" | "incidencia";

// Las fotos de ticket van detrás de un endpoint autenticado (no una URL publica),
// asi que no vale un <img src> directo: hay que pedirla con el token y convertirla
// en blob URL. Ver lib/api-client.ts#getBlob.
function FotoTicket({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    let objectUrl: string | null = null;

    apiClient
      .getBlob(url)
      .then((blob) => {
        if (cancelado) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {});

    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (!src) {
    return <div className={cn(className, "animate-pulse bg-muted")} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}

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
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery<Ticket[]>({
    queryKey: ["mis-tickets"],
    queryFn: () => apiClient.get<Ticket[]>("/tickets/mis-tickets"),
  });

  function cerrarEdicion() {
    setEditingId(null);
    setEditForm(null);
  }

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete<void>(`/tickets/mis-tickets/${id}`),
    onSuccess: () => {
      toast.success("Ticket eliminado");
      setExpandedId(null);
      cerrarEdicion();
      queryClient.invalidateQueries({ queryKey: ["mis-tickets"] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "No se pudo eliminar el ticket");
    },
  });

  const actualizarMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: unknown }) =>
      apiClient.patch<Ticket>(`/tickets/mis-tickets/${id}`, body),
    onSuccess: () => {
      toast.success("Ticket actualizado");
      cerrarEdicion();
      queryClient.invalidateQueries({ queryKey: ["mis-tickets"] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "No se pudo actualizar el ticket");
    },
  });

  function eliminar(id: number) {
    if (!window.confirm("¿Eliminar este ticket? No se podrá deshacer.")) return;
    eliminarMutation.mutate(id);
  }

  function guardarEdicion(id: number) {
    if (!editForm) return;
    const esPeaje = editForm.tipoGasto === "PEAJE";
    actualizarMutation.mutate({
      id,
      body: {
        estacion: editForm.estacion,
        fechaHora: editForm.fechaHora,
        importeTotal: Number(editForm.importeTotal),
        litros: esPeaje || !editForm.litros ? null : Number(editForm.litros),
        precioLitro: esPeaje || !editForm.precioLitro ? null : Number(editForm.precioLitro),
        tipoGasto: editForm.tipoGasto,
      },
    });
  }

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
            const expandido = expandedId === t.id;
            const editando = editingId === t.id;
            const puedeEditar = estado === "pendiente";
            const fotos = (t.lineas ?? []).map((l) => l.fotoUrl).filter((u): u is string => !!u);

            return (
              <div
                key={t.id}
                className="rounded-xl border border-border bg-card shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expandido ? null : t.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <Receipt className="size-4 shrink-0 text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {t.estacion ?? "Sin estación"}
                      </p>
                      {t.tipoGasto === "PEAJE" && (
                        <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                          Peaje
                        </span>
                      )}
                    </div>
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
                </button>

                {expandido && !editando && (
                  <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
                    {fotos.length > 0 ? (
                      <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {fotos.map((url, idx) => (
                          <FotoTicket
                            key={idx}
                            url={url}
                            alt={`Foto ${idx + 1} del ticket`}
                            className="h-28 w-28 shrink-0 rounded-lg border border-border object-cover"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ImageOff className="size-4" />
                        Sin foto guardada
                      </div>
                    )}

                    {puedeEditar && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(t.id);
                            setEditForm(ticketToEditForm(t));
                          }}
                          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted"
                        >
                          <Pencil className="size-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminar(t.id)}
                          disabled={eliminarMutation.isPending}
                          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 text-xs font-semibold text-destructive hover:bg-destructive/15 disabled:opacity-50"
                        >
                          <Trash2 className="size-3.5" />
                          Eliminar
                        </button>
                      </div>
                    )}
                    {!puedeEditar && (
                      <p className="text-[11px] text-muted-foreground">
                        Ya no se puede editar: el ticket está en estado &quot;{estadoLabel(estado)}&quot;.
                      </p>
                    )}
                  </div>
                )}

                {editando && editForm && (
                  <div className="flex flex-col gap-2.5 border-t border-border px-4 py-3">
                    <div className="flex gap-2 rounded-lg border border-border bg-muted p-1">
                      {(["COMBUSTIBLE", "PEAJE"] as TipoGasto[]).map((opcion) => (
                        <button
                          key={opcion}
                          type="button"
                          onClick={() => setEditForm((f) => (f ? { ...f, tipoGasto: opcion } : f))}
                          className={cn(
                            "flex h-8 flex-1 items-center justify-center rounded-md text-xs font-semibold transition-colors",
                            editForm.tipoGasto === opcion
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {opcion === "COMBUSTIBLE" ? "Combustible" : "Peaje"}
                        </button>
                      ))}
                    </div>

                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      Estación
                      <Input
                        value={editForm.estacion}
                        onChange={(e) => setEditForm((f) => (f ? { ...f, estacion: e.target.value } : f))}
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      Importe total
                      <Input
                        type="number"
                        value={editForm.importeTotal}
                        onChange={(e) => setEditForm((f) => (f ? { ...f, importeTotal: e.target.value } : f))}
                      />
                    </label>

                    {editForm.tipoGasto === "COMBUSTIBLE" && (
                      <div className="flex gap-2">
                        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
                          Litros
                          <Input
                            type="number"
                            value={editForm.litros}
                            onChange={(e) => setEditForm((f) => (f ? { ...f, litros: e.target.value } : f))}
                          />
                        </label>
                        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
                          Precio/L
                          <Input
                            type="number"
                            value={editForm.precioLitro}
                            onChange={(e) => setEditForm((f) => (f ? { ...f, precioLitro: e.target.value } : f))}
                          />
                        </label>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={cerrarEdicion}
                        className="flex h-9 flex-1 items-center justify-center rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => guardarEdicion(t.id)}
                        disabled={actualizarMutation.isPending}
                        className="flex h-9 flex-1 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </MobileShell>
  );
}
