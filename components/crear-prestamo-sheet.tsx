"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, CreditCard, Car, Radio, Loader2, Check } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TipoRecurso = "TARJETA" | "VEHICULO" | "VIAT";

interface RecursoDisponible {
  id: number;
  descripcion: string;
  detalle: string | null;
}

interface CentroCoste {
  id: number;
  nombre: string;
  codigo?: string;
}

const tiposRecurso: { value: TipoRecurso; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "TARJETA", label: "Tarjeta", icon: CreditCard },
  { value: "VEHICULO", label: "Vehículo", icon: Car },
  { value: "VIAT", label: "Viat", icon: Radio },
];

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

export function CrearPrestamoSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const [tipo, setTipo] = useState<TipoRecurso | null>(null);
  const [recursoId, setRecursoId] = useState<number | null>(null);
  const [centroCosteId, setCentroCosteId] = useState<number | null>(null);
  const [fechaInicio, setFechaInicio] = useState(todayIso());
  const [fechaFin, setFechaFin] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const { data: recursos = [], isLoading: loadingRecursos } = useQuery<RecursoDisponible[]>({
    queryKey: ["recursos-disponibles", tipo],
    queryFn: () =>
      apiClient.get<RecursoDisponible[]>(`/prestamos/recursos-disponibles?tipo=${tipo}`),
    enabled: !!tipo && open,
    staleTime: 30_000,
  });

  const { data: centros = [] } = useQuery<CentroCoste[]>({
    queryKey: ["centros-coste"],
    queryFn: () => apiClient.get<CentroCoste[]>("/centros-coste"),
    enabled: open,
    staleTime: 300_000,
  });

  const crearMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiClient.post("/prestamos/mis-prestamos", payload),
    onSuccess: () => {
      toast.success("Préstamo creado");
      queryClient.invalidateQueries({ queryKey: ["mis-prestamos"] });
      handleClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo crear el préstamo");
    },
  });

  function handleClose() {
    setTipo(null);
    setRecursoId(null);
    setCentroCosteId(null);
    setFechaInicio(todayIso());
    setFechaFin("");
    setObservaciones("");
    onClose();
  }

  function handleSubmit() {
    if (!tipo || !recursoId || !centroCosteId || !fechaInicio) return;
    const payload: Record<string, unknown> = {
      tipoRecurso: tipo,
      centroCosteId,
      fechaInicio,
    };
    if (tipo === "TARJETA") payload.tarjetaId = recursoId;
    if (tipo === "VEHICULO") payload.vehiculoId = recursoId;
    if (tipo === "VIAT") payload.viatId = recursoId;
    if (fechaFin) payload.fechaFinPrevista = fechaFin;
    if (observaciones.trim()) payload.observaciones = observaciones.trim();
    crearMutation.mutate(payload);
  }

  const canSubmit = tipo && recursoId && centroCosteId && fechaInicio && !crearMutation.isPending;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={handleClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[480px] flex-col rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">Nuevo préstamo</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Auto-asígnate un recurso disponible
            </p>
          </div>
          <button
            onClick={handleClose}
            className="flex size-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Tipo */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Tipo de recurso
            </label>
            <div className="grid grid-cols-3 gap-2">
              {tiposRecurso.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setTipo(value);
                    setRecursoId(null);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 transition-all active:scale-[0.98]",
                    tipo === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-5" />
                  <span className="text-xs font-semibold">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recurso */}
          {tipo && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Recurso disponible
              </label>
              {loadingRecursos ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-primary" />
                </div>
              ) : recursos.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">
                  No hay {tipo.toLowerCase()}s disponibles ahora
                </p>
              ) : (
                <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-border p-1.5">
                  {recursos.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRecursoId(r.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors",
                        recursoId === r.id
                          ? "bg-primary/15 text-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{r.descripcion}</p>
                        {r.detalle && (
                          <p className="truncate text-xs text-muted-foreground">{r.detalle}</p>
                        )}
                      </div>
                      {recursoId === r.id && <Check className="size-4 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Centro de coste */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Centro de coste
            </label>
            <select
              value={centroCosteId ?? ""}
              onChange={(e) => setCentroCosteId(e.target.value ? Number(e.target.value) : null)}
              className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">Seleccionar...</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo ? `${c.codigo} — ` : ""}{c.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Desde
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Hasta (opcional)
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                min={fechaInicio}
                className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Observaciones (opcional)
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Motivo, ubicación, etc."
              className="w-full resize-none rounded-xl border border-border bg-card p-3 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/30",
              "transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {crearMutation.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Creando...
              </>
            ) : (
              "Crear préstamo"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
