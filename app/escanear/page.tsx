"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Camera,
  ZapOff,
  Zap,
  Images,
  RefreshCw,
  CheckCircle,
  Loader2,
  AlertCircle,
  Home,
  ChevronLeft,
  CloudUpload,
  Fingerprint,
  Car,
  Hammer,
  CreditCard,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import { PinInput } from "@/components/shared/pin-input";
import { SearchableSheetSelect } from "@/components/shared/searchable-sheet-select";
import { apiClient, ApiError } from "@/lib/api-client";
import {
  addRecent,
  getLastUsed,
  getRecentItems,
} from "@/lib/recent-storage";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;
type Categoria = "VEHICULO" | "INDUSTRIAL_MAQUINARIA";

interface Vehiculo {
  id: number;
  nombre?: string;
  matricula?: string;
  codigoObra?: string;
  categoria: Categoria;
  centroCosteId?: number;
}

interface CentroCoste {
  id: number;
  nombre: string;
}

interface Tarjeta {
  id: number;
  numeroTarjetaUltimos4: string;
  alias?: string | null;
  proveedor?: string;
  tienePinGuardado: boolean;
}

interface OcrRawData {
  estacion?: string;
  fecha?: string;
  hora?: string;
  litros?: number;
  precioLitro?: number;
  importeTotal?: number;
  producto?: string;
  matricula?: string;
  kms?: number;
  numRecibo?: string;
}

interface OcrResponse {
  status?: string;
  ticketId?: number;
  message?: string;
  ocrData?: string;
}

interface Step2State {
  categoria: Categoria;
  vehiculoId: number | null;
  centroCosteId: number | null;
  tarjetaId: number | null;
  kilometros: string;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

function vehiculoKey(cat: Categoria): string {
  return cat === "VEHICULO" ? "vehiculo-VEHICULO" : "vehiculo-INDUSTRIAL_MAQUINARIA";
}

const CENTRO_KEY = "centro-coste";

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatFechaHora(fecha?: string, hora?: string): string | null {
  if (!fecha) return null;
  try {
    const [y, m, d] = fecha.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const dateStr = dt.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return hora ? `${dateStr} · ${hora}` : dateStr;
  } catch {
    return fecha;
  }
}

function formatCurrency(value?: number): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatLitros(value?: number): string | null {
  if (value == null) return null;
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value)} L`;
}

function formatPrecioLitro(value?: number): string | null {
  if (value == null) return null;
  return `${new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value)} €/L`;
}

function formatKm(value?: number): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat("es-ES").format(value);
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

const STEPS = [
  { key: 1, label: "Captura" },
  { key: 2, label: "Datos" },
  { key: 3, label: "PIN" },
] as const;

function Stepper({ current }: { current: Step }) {
  return (
    <div className="flex items-center px-6 py-3">
      {STEPS.map((step, idx) => {
        const active = step.key === current;
        const done = step.key < current;
        return (
          <div key={step.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-all",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : done
                    ? "border-success bg-success text-white"
                    : "border-border bg-muted text-muted-foreground",
                )}
              >
                {done ? "✓" : step.key}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium",
                  active
                    ? "text-primary"
                    : done
                    ? "text-success"
                    : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-1 mb-4",
                  done ? "bg-success" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1 — Camera ─────────────────────────────────────────────────────────

function CameraStep({
  onCapture,
}: {
  onCapture: (blob: Blob, preview: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [flash, setFlash] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraError(false);
    } catch {
      setCameraError(true);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera]);

  function handleCapture() {
    if (!videoRef.current || !canvasRef.current || capturing) return;
    setCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const preview = canvas.toDataURL("image/jpeg", 0.85);
          onCapture(blob, preview);
        }
        setCapturing(false);
      },
      "image/jpeg",
      0.85,
    );
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(30);
    }
  }

  function handleGallery(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const preview = reader.result as string;
      onCapture(file, preview);
    };
    reader.readAsDataURL(file);
  }

  function toggleFlash() {
    setFlash((f) => !f);
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      const cap = track.getCapabilities() as MediaTrackCapabilities & {
        torch?: boolean;
      };
      if (cap.torch) {
        track
          .applyConstraints({
            advanced: [{ torch: !flash } as MediaTrackConstraintSet],
          })
          .catch(() => {});
      }
    }
  }

  if (cameraError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        <Camera className="size-14 text-muted-foreground" />
        <p className="text-base font-semibold text-foreground">
          Sin acceso a la cámara
        </p>
        <p className="text-sm text-muted-foreground">
          No se pudo acceder a la cámara. Permite el acceso en la configuración
          del navegador o usa la galería.
        </p>
        <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-md shadow-primary/30 transition-all hover:bg-primary/90">
          <Images className="size-4" />
          Seleccionar de galería
          <input
            type="file"
            accept="image/*"
            onChange={handleGallery}
            className="sr-only"
          />
        </label>
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden bg-black">
      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 size-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Frame overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          className="absolute inset-0 bg-black/40"
          style={{
            maskImage:
              "radial-gradient(ellipse 65% 70% at center, transparent 0%, black 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 65% 70% at center, transparent 0%, black 100%)",
          }}
        />
        <div className="relative h-72 w-56">
          <span className="absolute left-0 top-0 h-6 w-6 border-l-[3px] border-t-[3px] border-primary rounded-tl-md" />
          <span className="absolute right-0 top-0 h-6 w-6 border-r-[3px] border-t-[3px] border-primary rounded-tr-md" />
          <span className="absolute bottom-0 left-0 h-6 w-6 border-b-[3px] border-l-[3px] border-primary rounded-bl-md" />
          <span className="absolute bottom-0 right-0 h-6 w-6 border-b-[3px] border-r-[3px] border-primary rounded-br-md" />
        </div>
        <p className="relative mt-4 text-sm text-white/70">
          Centra el ticket dentro del marco
        </p>
      </div>

      {/* Top controls */}
      <div className="absolute left-0 right-0 top-0 flex items-center justify-end gap-2 bg-gradient-to-b from-black/50 to-transparent px-4 py-3">
        <button
          onClick={toggleFlash}
          className="flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
          aria-label="Toggle flash"
        >
          {flash ? (
            <Zap className="size-4 text-warning" />
          ) : (
            <ZapOff className="size-4" />
          )}
        </button>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-8 pb-6 pt-10">
        <label className="flex cursor-pointer flex-col items-center gap-1">
          <div className="flex size-12 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
            <Images className="size-5 text-white" />
          </div>
          <span className="text-[10px] text-white/70">Galería</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleGallery}
            className="sr-only"
          />
        </label>

        <button
          onClick={handleCapture}
          disabled={capturing}
          className={cn(
            "flex size-16 items-center justify-center rounded-full border-4 border-white bg-white/20 backdrop-blur-sm transition-all active:scale-95",
            capturing && "opacity-60",
          )}
          aria-label="Capturar"
        >
          {capturing ? (
            <Loader2 className="size-6 animate-spin text-white" />
          ) : (
            <div className="size-12 rounded-full bg-white" />
          )}
        </button>

        <div className="size-12" />
      </div>
    </div>
  );
}

// ─── Vehicle trigger render ───────────────────────────────────────────────────

function VehiculoTrigger({
  vehiculo,
  categoria,
}: {
  vehiculo: Vehiculo | null;
  categoria: Categoria;
}) {
  if (!vehiculo) {
    return (
      <div className="flex items-center gap-2.5 text-muted-foreground">
        {categoria === "VEHICULO" ? (
          <Car className="size-4 shrink-0" />
        ) : (
          <Hammer className="size-4 shrink-0" />
        )}
        <span className="text-sm">
          {categoria === "VEHICULO"
            ? "Selecciona vehículo"
            : "Selecciona maquinaria"}
        </span>
      </div>
    );
  }

  const identifier =
    categoria === "VEHICULO"
      ? vehiculo.matricula ?? `#${vehiculo.id}`
      : vehiculo.codigoObra ?? `#${vehiculo.id}`;

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        {categoria === "VEHICULO" ? (
          <Car className="size-4 text-primary" />
        ) : (
          <Hammer className="size-4 text-primary" />
        )}
      </div>
      <div className="min-w-0">
        <p className="font-mono text-sm font-bold tracking-widest text-foreground">
          {identifier}
        </p>
        {vehiculo.nombre && (
          <p className="truncate text-xs text-muted-foreground">
            {vehiculo.nombre}
          </p>
        )}
      </div>
    </div>
  );
}

function VehiculoItem({
  vehiculo,
  categoria,
  isSelected,
}: {
  vehiculo: Vehiculo;
  categoria: Categoria;
  isSelected: boolean;
}) {
  const identifier =
    categoria === "VEHICULO"
      ? vehiculo.matricula ?? `#${vehiculo.id}`
      : vehiculo.codigoObra ?? `#${vehiculo.id}`;

  return (
    <div className="flex flex-1 items-center gap-3">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          isSelected ? "bg-primary/15" : "bg-muted",
        )}
      >
        {categoria === "VEHICULO" ? (
          <Car
            className={cn(
              "size-4",
              isSelected ? "text-primary" : "text-muted-foreground",
            )}
          />
        ) : (
          <Hammer
            className={cn(
              "size-4",
              isSelected ? "text-primary" : "text-muted-foreground",
            )}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-bold tracking-widest text-foreground">
          {identifier}
        </p>
        {vehiculo.nombre && (
          <p className="truncate text-xs text-muted-foreground">
            {vehiculo.nombre}
          </p>
        )}
      </div>
      {isSelected && (
        <CheckCircle className="size-4 shrink-0 text-primary" />
      )}
    </div>
  );
}

// ─── Centro coste trigger/item renders ───────────────────────────────────────

function CentroTrigger({ centro }: { centro: CentroCoste | null }) {
  if (!centro) {
    return (
      <span className="text-sm text-muted-foreground">
        Selecciona centro de coste
      </span>
    );
  }
  return <span className="text-sm font-semibold text-foreground">{centro.nombre}</span>;
}

function CentroItem({
  centro,
  isSelected,
}: {
  centro: CentroCoste;
  isSelected: boolean;
}) {
  return (
    <div className="flex flex-1 items-center justify-between">
      <span
        className={cn(
          "text-sm",
          isSelected ? "font-semibold text-foreground" : "text-foreground",
        )}
      >
        {centro.nombre}
      </span>
      {isSelected && <CheckCircle className="size-4 shrink-0 text-primary" />}
    </div>
  );
}

// ─── Tarjeta trigger/item renders ────────────────────────────────────────────

function TarjetaTrigger({ tarjeta }: { tarjeta: Tarjeta | null }) {
  if (!tarjeta) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <CreditCard className="size-4 shrink-0" />
        <span className="text-sm">Selecciona tarjeta</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <CreditCard className="size-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          {tarjeta.alias ?? `Tarjeta ${tarjeta.proveedor ?? ""}`}
        </p>
        <p className="text-xs tracking-widest text-muted-foreground">
          **** {tarjeta.numeroTarjetaUltimos4}
        </p>
      </div>
    </div>
  );
}

function TarjetaItem({
  tarjeta,
  isSelected,
}: {
  tarjeta: Tarjeta;
  isSelected: boolean;
}) {
  return (
    <div className="flex flex-1 items-center gap-3">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          isSelected ? "bg-primary/15" : "bg-muted",
        )}
      >
        <CreditCard
          className={cn(
            "size-4",
            isSelected ? "text-primary" : "text-muted-foreground",
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {tarjeta.alias ?? `Tarjeta ${tarjeta.proveedor ?? ""}`}
        </p>
        <p className="text-xs tracking-widest text-muted-foreground">
          **** {tarjeta.numeroTarjetaUltimos4}
        </p>
      </div>
      {isSelected && (
        <CheckCircle className="size-4 shrink-0 text-primary" />
      )}
    </div>
  );
}

// ─── Step 2 — Preview + form ─────────────────────────────────────────────────

function PreviewStep({
  preview,
  state,
  setState,
  onBack,
  onContinue,
}: {
  preview: string;
  state: Step2State;
  setState: React.Dispatch<React.SetStateAction<Step2State>>;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { data: vehiculos = [] } = useQuery<Vehiculo[]>({
    queryKey: ["vehiculos", state.categoria],
    queryFn: () =>
      apiClient.get<Vehiculo[]>(
        `/vehiculos?activo=true&categoria=${state.categoria}`,
      ),
  });

  const { data: centros = [] } = useQuery<CentroCoste[]>({
    queryKey: ["centros-coste"],
    queryFn: () => apiClient.get<CentroCoste[]>("/centros-coste?activo=true"),
  });

  const { data: tarjetas = [] } = useQuery<Tarjeta[]>({
    queryKey: ["mis-tarjetas"],
    queryFn: () => apiClient.get<Tarjeta[]>("/tarjetas/mis-tarjetas"),
  });

  // ── Preload last-used from localStorage on mount / categoria change ────────
  useEffect(() => {
    if (vehiculos.length === 0) return;
    const lastVehiculo = getLastUsed(vehiculoKey(state.categoria), vehiculos);
    if (lastVehiculo && state.vehiculoId === null) {
      setState((s) => ({
        ...s,
        vehiculoId: lastVehiculo.id,
        centroCosteId: lastVehiculo.centroCosteId ?? s.centroCosteId,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiculos, state.categoria]);

  useEffect(() => {
    if (centros.length === 0) return;
    const lastCentro = getLastUsed(CENTRO_KEY, centros);
    if (lastCentro && state.centroCosteId === null) {
      setState((s) => ({ ...s, centroCosteId: lastCentro.id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centros]);

  // Auto-select single tarjeta
  useEffect(() => {
    if (tarjetas.length === 1 && state.tarjetaId === null) {
      setState((s) => ({ ...s, tarjetaId: tarjetas[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarjetas]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const selectedVehiculo = vehiculos.find((v) => v.id === state.vehiculoId) ?? null;
  const selectedCentro = centros.find((c) => c.id === state.centroCosteId) ?? null;
  const selectedTarjeta = tarjetas.find((t) => t.id === state.tarjetaId) ?? null;

  const recentVehiculos = getRecentItems(vehiculoKey(state.categoria), vehiculos, 3);
  const recentCentros = getRecentItems(CENTRO_KEY, centros, 3);

  const canContinue = state.vehiculoId !== null && state.tarjetaId !== null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleCategoriaChange(c: Categoria) {
    setState((s) => ({ ...s, categoria: c, vehiculoId: null }));
  }

  function handleVehiculoSelect(v: Vehiculo) {
    setState((s) => ({
      ...s,
      vehiculoId: v.id,
      centroCosteId: v.centroCosteId ?? s.centroCosteId,
    }));
  }

  function handleCentroSelect(c: CentroCoste) {
    setState((s) => ({ ...s, centroCosteId: c.id }));
  }

  function handleTarjetaSelect(t: Tarjeta) {
    setState((s) => ({ ...s, tarjetaId: t.id }));
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Preview */}
      <div className="mx-4 mt-4 overflow-hidden rounded-2xl border border-border">
        <img
          src={preview}
          alt="Preview del ticket"
          className="max-h-48 w-full object-contain bg-black"
        />
        <div className="flex justify-center border-t border-border bg-card py-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-primary"
          >
            <RefreshCw className="size-3.5" />
            Repetir foto
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-5 px-4 py-4">

        {/* Tipo de gasto — chip selector */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tipo de gasto
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleCategoriaChange("VEHICULO")}
              className={cn(
                "flex h-14 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors",
                state.categoria === "VEHICULO"
                  ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              <Car className="size-4" />
              Vehículo
            </button>
            <button
              type="button"
              onClick={() => handleCategoriaChange("INDUSTRIAL_MAQUINARIA")}
              className={cn(
                "flex h-14 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors",
                state.categoria === "INDUSTRIAL_MAQUINARIA"
                  ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              <Hammer className="size-4" />
              Industrial
            </button>
          </div>
        </div>

        {/* Vehículo / Maquinaria — searchable sheet */}
        <SearchableSheetSelect<Vehiculo>
          label={state.categoria === "VEHICULO" ? "Vehículo" : "Maquinaria"}
          required
          title={
            state.categoria === "VEHICULO"
              ? "Selecciona vehículo"
              : "Selecciona maquinaria"
          }
          value={selectedVehiculo}
          onChange={handleVehiculoSelect}
          items={vehiculos}
          emptyMessage={
            state.categoria === "VEHICULO"
              ? "No hay vehículos disponibles"
              : "No hay maquinaria disponible"
          }
          searchPlaceholder={
            state.categoria === "VEHICULO"
              ? "Buscar por matrícula o descripción..."
              : "Buscar por código o descripción..."
          }
          getKey={(v) => v.id}
          getSearchText={(v) =>
            [v.matricula, v.codigoObra, v.nombre].filter(Boolean).join(" ")
          }
          recentItems={recentVehiculos}
          recentLabel="Últimos usados"
          renderTrigger={(v) => (
            <VehiculoTrigger vehiculo={v} categoria={state.categoria} />
          )}
          renderItem={(v, isSelected) => (
            <VehiculoItem
              vehiculo={v}
              categoria={state.categoria}
              isSelected={isSelected}
            />
          )}
        />

        {/* Kilómetros — only for vehicles */}
        {state.categoria === "VEHICULO" && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Kilómetros (opcional)
            </p>
            <input
              type="number"
              value={state.kilometros}
              onChange={(e) =>
                setState((s) => ({ ...s, kilometros: e.target.value }))
              }
              placeholder="Ej: 45320"
              inputMode="numeric"
              className="h-14 rounded-xl border border-border bg-input px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
        )}

        {/* Centro de coste — searchable sheet */}
        <SearchableSheetSelect<CentroCoste>
          label="Centro de coste"
          title="Selecciona centro de coste"
          value={selectedCentro}
          onChange={handleCentroSelect}
          items={centros}
          emptyMessage="No hay centros de coste disponibles"
          searchPlaceholder="Buscar centro..."
          getKey={(c) => c.id}
          getSearchText={(c) => c.nombre}
          recentItems={recentCentros}
          recentLabel="Últimos usados"
          renderTrigger={(c) => <CentroTrigger centro={c} />}
          renderItem={(c, isSelected) => (
            <CentroItem centro={c} isSelected={isSelected} />
          )}
        />

        {/* Tarjeta — sheet if multiple, inline card if single */}
        {tarjetas.length === 1 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tarjeta de combustible
            </p>
            <div className="flex min-h-[56px] items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <CreditCard className="size-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {tarjetas[0].alias ??
                    `Tarjeta ${tarjetas[0].proveedor ?? ""}`}
                </p>
                <p className="text-xs tracking-widest text-muted-foreground">
                  **** {tarjetas[0].numeroTarjetaUltimos4}
                </p>
              </div>
              <CheckCircle className="size-4 shrink-0 text-primary" />
            </div>
          </div>
        ) : (
          <SearchableSheetSelect<Tarjeta>
            label="Tarjeta de combustible"
            required
            title="Selecciona tarjeta"
            value={selectedTarjeta}
            onChange={handleTarjetaSelect}
            items={tarjetas}
            emptyMessage="Sin tarjetas asignadas"
            searchPlaceholder="Buscar tarjeta..."
            getKey={(t) => t.id}
            getSearchText={(t) =>
              [t.alias, t.proveedor, t.numeroTarjetaUltimos4]
                .filter(Boolean)
                .join(" ")
            }
            renderTrigger={(t) => <TarjetaTrigger tarjeta={t} />}
            renderItem={(t, isSelected) => (
              <TarjetaItem tarjeta={t} isSelected={isSelected} />
            )}
          />
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onBack}
            className="flex h-12 flex-1 items-center justify-center rounded-xl border border-border text-sm font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
          >
            Atrás
          </button>
          <button
            onClick={onContinue}
            disabled={!canContinue}
            className={cn(
              "flex h-12 flex-[2] items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/30",
              "transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3 — PIN + submit ───────────────────────────────────────────────────

function PinStep({
  tarjeta,
  onBack,
  onSuccess,
  imageBlob,
  step2State,
  onSaveRecents,
}: {
  tarjeta: Tarjeta;
  onBack: () => void;
  onSuccess: (result: OcrResponse) => void;
  imageBlob: Blob;
  step2State: Step2State;
  onSaveRecents: () => void;
}) {
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  const mutation = useMutation<OcrResponse, Error, string>({
    mutationFn: async (pinValue: string) => {
      const formData = new FormData();
      formData.append("imagen", imageBlob, "ticket.jpg");

      const params: Record<string, unknown> = {
        tarjetaId: tarjeta.id,
        pin: pinValue,
        categoriaRecurso: step2State.categoria,
        vehiculoId: step2State.vehiculoId,
      };
      if (step2State.centroCosteId) params.centroCosteId = step2State.centroCosteId;
      if (step2State.kilometros) params.kilometros = Number(step2State.kilometros);

      // params como Blob con Content-Type application/json para que Spring
      // (@RequestPart) lo deserialice correctamente. Sin esto llega como
      // application/octet-stream y devuelve 500.
      const paramsBlob = new Blob([JSON.stringify(params)], {
        type: "application/json",
      });
      formData.append("params", paramsBlob);
      return apiClient.upload<OcrResponse>("/tickets/ocr-validado", formData);
    },
    onSuccess: (data) => {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(50);
      }
      // Save recents on successful submission
      onSaveRecents();
      onSuccess(data);
    },
    onError: (err) => {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([50, 50, 50]);
      }
      const is401 = err instanceof ApiError && err.status === 401;
      setPinError(
        is401
          ? "PIN incorrecto. Comprueba el PIN de tu tarjeta e inténtalo de nuevo."
          : err instanceof ApiError
          ? err.message
          : "Error al enviar el ticket. Inténtalo de nuevo.",
      );
    },
  });

  async function handleSavedPin() {
    setPinError(null);
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      await navigator.credentials.get({
        publicKey: {
          challenge,
          userVerification: "required",
          timeout: 30_000,
        },
      });
      mutation.mutate("__saved__");
    } catch {
      toast.info("Verificación cancelada. Introduce el PIN manualmente.");
    }
  }

  function handleSend() {
    setPinError(null);
    if (pin.length < 4) {
      setPinError("Introduce los 4 dígitos del PIN");
      return;
    }
    mutation.mutate(pin);
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-5">
      {/* Tarjeta info */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
            <span className="text-lg">💳</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {tarjeta.alias ?? `Tarjeta ${tarjeta.proveedor ?? ""}`}
            </p>
            <p className="text-xs text-muted-foreground tracking-widest">
              **** {tarjeta.numeroTarjetaUltimos4}
            </p>
          </div>
        </div>

        {tarjeta.tienePinGuardado && (
          <button
            onClick={handleSavedPin}
            disabled={mutation.isPending}
            className="flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
          >
            <Fingerprint className="size-4" />
            Usar PIN guardado
          </button>
        )}
      </div>

      {tarjeta.tienePinGuardado && (
        <div className="my-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">
            o introduce el PIN
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      <div className="flex flex-col items-center gap-4 py-4">
        <p className="text-lg font-bold text-foreground">PIN de tarjeta</p>
        <p className="text-sm text-muted-foreground text-center">
          Introduce los 4 dígitos para autorizar el ticket.
        </p>

        <PinInput
          value={pin}
          onChange={(v) => {
            setPin(v);
            if (pinError) setPinError(null);
          }}
          disabled={mutation.isPending}
          error={!!pinError}
        />

        {pinError && (
          <div className="flex w-full items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{pinError}</p>
          </div>
        )}

        {mutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Enviando ticket...
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          disabled={mutation.isPending}
          className="flex h-12 flex-1 items-center justify-center rounded-xl border border-border text-sm font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98] disabled:opacity-50"
        >
          Atrás
        </button>
        <button
          onClick={handleSend}
          disabled={pin.length < 4 || mutation.isPending}
          className={cn(
            "flex h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/30",
            "transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CloudUpload className="size-4" />
          )}
          {mutation.isPending ? "Enviando..." : "Enviar ticket"}
        </button>
      </div>
    </div>
  );
}

// ─── Success view ─────────────────────────────────────────────────────────────

interface OcrField {
  label: string;
  value: string | null;
}

function SuccessView({
  result,
  tarjeta,
  onHome,
  onScanAnother,
}: {
  result: OcrResponse;
  tarjeta: Tarjeta | null;
  onHome: () => void;
  onScanAnother: () => void;
}) {
  // Parse ocrData (string JSON)
  let ocr: OcrRawData | null = null;
  if (result.ocrData) {
    try {
      ocr = JSON.parse(result.ocrData) as OcrRawData;
    } catch {
      ocr = null;
    }
  }

  const fields: OcrField[] = ocr
    ? [
        { label: "Estación", value: ocr.estacion ?? null },
        {
          label: "Fecha y hora",
          value: formatFechaHora(ocr.fecha, ocr.hora),
        },
        { label: "Producto", value: ocr.producto ?? null },
        { label: "Litros", value: formatLitros(ocr.litros) },
        { label: "Precio/L", value: formatPrecioLitro(ocr.precioLitro) },
        { label: "Importe", value: formatCurrency(ocr.importeTotal) },
        { label: "Matrícula", value: ocr.matricula ?? null },
        { label: "Km", value: formatKm(ocr.kms) },
        { label: "Nº recibo", value: ocr.numRecibo ?? null },
      ].filter((f): f is { label: string; value: string } => f.value !== null)
    : [];

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
      {/* Success icon */}
      <div className="flex flex-col items-center gap-3 pb-5">
        <div className="flex size-20 items-center justify-center rounded-full bg-success/15 border-2 border-success/30">
          <CheckCircle className="size-10 text-success" />
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-foreground">Ticket procesado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu gasto se ha registrado correctamente
          </p>
        </div>
      </div>

      {/* OCR data card */}
      {fields.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-sm">
          <div className="border-b border-border bg-primary/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Datos extraídos del ticket
            </p>
          </div>
          <div className="divide-y divide-border">
            {fields.map((field) => (
              <div
                key={field.label}
                className="flex items-baseline justify-between gap-4 px-4 py-2.5"
              >
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {field.label}
                </span>
                <span className="font-mono text-sm tabular-nums text-foreground">
                  {field.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ticket metadata */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="divide-y divide-border">
          {result.ticketId && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ticket ID
              </span>
              <span className="font-mono text-sm font-bold text-foreground">
                #{result.ticketId}
              </span>
            </div>
          )}
          {tarjeta && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tarjeta
              </span>
              <span className="text-sm text-foreground tracking-widest">
                **** {tarjeta.numeroTarjetaUltimos4}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Estado
            </span>
            <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-semibold text-warning">
              Pendiente de cotejo
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onHome}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
        >
          <Home className="size-4" />
          Inicio
        </button>
        <button
          onClick={onScanAnother}
          className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/30 transition-all hover:bg-primary/90 active:scale-[0.98]"
        >
          <ScanLine className="size-4" />
          Escanear otro
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EscanearPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [done, setDone] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResponse | null>(null);

  const [step2State, setStep2State] = useState<Step2State>({
    categoria: "VEHICULO",
    vehiculoId: null,
    centroCosteId: null,
    tarjetaId: null,
    kilometros: "",
  });

  const { data: tarjetas = [] } = useQuery<Tarjeta[]>({
    queryKey: ["mis-tarjetas"],
    queryFn: () => apiClient.get<Tarjeta[]>("/tarjetas/mis-tarjetas"),
    enabled: step === 3,
  });

  const selectedTarjeta =
    tarjetas.find((t) => t.id === step2State.tarjetaId) ?? null;

  function handleCapture(blob: Blob, previewUrl: string) {
    setImageBlob(blob);
    setPreview(previewUrl);
    setStep(2);
  }

  function handleBack() {
    if (step === 1) router.back();
    else if (step === 2) setStep(1);
    else setStep(2);
  }

  function handleSaveRecents() {
    if (step2State.vehiculoId !== null) {
      addRecent(vehiculoKey(step2State.categoria), step2State.vehiculoId);
    }
    if (step2State.centroCosteId !== null) {
      addRecent(CENTRO_KEY, step2State.centroCosteId);
    }
  }

  function handleScanAnother() {
    setDone(false);
    setOcrResult(null);
    setImageBlob(null);
    setPreview("");
    setStep2State({
      categoria: "VEHICULO",
      vehiculoId: null,
      centroCosteId: null,
      tarjetaId: null,
      kilometros: "",
    });
    setStep(1);
  }

  if (done && ocrResult) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-border px-4 py-3">
            <h1 className="text-base font-bold text-foreground">
              Ticket registrado
            </h1>
          </header>
          <SuccessView
            result={ocrResult}
            tarjeta={selectedTarjeta}
            onHome={() => router.push("/")}
            onScanAnother={handleScanAnother}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button
            onClick={handleBack}
            className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-muted"
            aria-label="Volver"
          >
            <ChevronLeft className="size-5 text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">Nuevo ticket</h1>
        </header>

        {/* Stepper */}
        <Stepper current={step} />

        {/* Step content */}
        {step === 1 && <CameraStep onCapture={handleCapture} />}

        {step === 2 && imageBlob && (
          <PreviewStep
            preview={preview}
            state={step2State}
            setState={setStep2State}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
          />
        )}

        {step === 3 && imageBlob && selectedTarjeta && (
          <PinStep
            tarjeta={selectedTarjeta}
            onBack={() => setStep(2)}
            onSuccess={(result) => {
              setOcrResult(result);
              setDone(true);
            }}
            imageBlob={imageBlob}
            step2State={step2State}
            onSaveRecents={handleSaveRecents}
          />
        )}

        {/* Fallback if tarjeta not found at step 3 */}
        {step === 3 && !selectedTarjeta && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <AlertCircle className="size-10 text-destructive" />
            <p className="text-sm text-muted-foreground">
              No se encontró la tarjeta seleccionada. Vuelve al paso anterior.
            </p>
            <button
              onClick={() => setStep(2)}
              className="text-sm font-semibold text-primary"
            >
              Volver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
