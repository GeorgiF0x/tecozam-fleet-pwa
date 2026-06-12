"use client";

import {
  useState,
  useEffect,
  useRef,
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
  Car,
  Hammer,
  CreditCard,
  ScanLine,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { SearchableSheetSelect } from "@/components/shared/searchable-sheet-select";
import { apiClient, ApiError } from "@/lib/api-client";
import {
  addRecent,
  getLastUsed,
  getRecentItems,
} from "@/lib/recent-storage";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | "camera"
  | "image-preview"
  | "assignment"
  | "ocr-edit"
  | "success";

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

interface OcrPreviewData {
  estacion?: string;
  fechaHora?: string;
  importeTotal?: number;
  litros?: number;
  precioLitro?: number;
  producto?: string;
  numRecibo?: string;
  matricula?: string;
  kms?: number;
  ocrRaw?: string;
}

interface OcrResponse {
  status?: string;
  ticketId?: number;
  message?: string;
  ocrData?: string;
}

interface AssignState {
  categoria: Categoria;
  vehiculoId: number | null;
  centroCosteId: number | null;
  tarjetaId: number | null;
  kilometros: string;
}

// Editable OCR data — populated from preview, may be edited by user
interface EditableOcrData {
  estacion: string;
  fechaHora: string;
  importeTotal: string;
  litros: string;
  precioLitro: string;
  producto: string;
  numRecibo: string;
  matricula: string;
  ocrRaw: string;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

function vehiculoKey(cat: Categoria): string {
  return cat === "VEHICULO" ? "vehiculo-VEHICULO" : "vehiculo-INDUSTRIAL_MAQUINARIA";
}

const CENTRO_KEY = "centro-coste";

// ─── OCR preview → EditableOcrData conversion ─────────────────────────────────

function previewToEditable(data: OcrPreviewData): EditableOcrData {
  return {
    estacion: data.estacion ?? "",
    fechaHora: data.fechaHora ?? "",
    importeTotal: data.importeTotal != null ? String(data.importeTotal) : "",
    litros: data.litros != null ? String(data.litros) : "",
    precioLitro: data.precioLitro != null ? String(data.precioLitro) : "",
    producto: data.producto ?? "",
    numRecibo: data.numRecibo ?? "",
    matricula: data.matricula ?? "",
    ocrRaw: data.ocrRaw ?? "",
  };
}

function emptyEditable(): EditableOcrData {
  return {
    estacion: "",
    fechaHora: "",
    importeTotal: "",
    litros: "",
    precioLitro: "",
    producto: "",
    numRecibo: "",
    matricula: "",
    ocrRaw: "",
  };
}

// ─── Formatters ───────────────────────────────────────────────────────────────

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

// ─── Stepper ─────────────────────────────────────────────────────────────────

const STEPS = [
  { key: 1, label: "Captura" },
  { key: 2, label: "Asignación" },
  { key: 3, label: "Datos" },
] as const;

function stepToVisual(step: Step): number {
  switch (step) {
    case "camera":
    case "image-preview":
      return 1;
    case "assignment":
      return 2;
    case "ocr-edit":
      return 3;
    case "success":
      return 3;
  }
}

function Stepper({ current }: { current: Step }) {
  const visual = stepToVisual(current);
  return (
    <div className="flex items-center px-6 py-3">
      {STEPS.map((step, idx) => {
        const active = step.key === visual;
        const done = step.key < visual;
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

// ─── Step 2 — Image Preview ───────────────────────────────────────────────────

function ImagePreviewStep({
  preview,
  onBack,
  onContinue,
}: {
  preview: string;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-4 mt-4 overflow-hidden rounded-2xl border border-border">
        <img
          src={preview}
          alt="Preview del ticket"
          className="max-h-64 w-full object-contain bg-black"
        />
      </div>

      <div className="flex flex-col gap-3 px-4 py-5">
        <p className="text-sm text-muted-foreground text-center">
          Comprueba que el ticket se ve nítido antes de continuar.
        </p>

        <button
          onClick={onBack}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
        >
          <RefreshCw className="size-4" />
          Repetir foto
        </button>

        <button
          onClick={onContinue}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/30 transition-all hover:bg-primary/90 active:scale-[0.98]"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

// ─── Vehicle / Centro / Tarjeta trigger + item renders ────────────────────────

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

// ─── Step 3 — Assignment ─────────────────────────────────────────────────────

function AssignmentStep({
  assignState,
  setAssignState,
  onBack,
  onContinue,
}: {
  assignState: AssignState;
  setAssignState: React.Dispatch<React.SetStateAction<AssignState>>;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { data: vehiculos = [] } = useQuery<Vehiculo[]>({
    queryKey: ["vehiculos", assignState.categoria],
    queryFn: () =>
      apiClient.get<Vehiculo[]>(
        `/vehiculos?activo=true&categoria=${assignState.categoria}`,
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

  // Preload last-used from localStorage
  useEffect(() => {
    if (vehiculos.length === 0) return;
    const lastVehiculo = getLastUsed(vehiculoKey(assignState.categoria), vehiculos);
    if (lastVehiculo && assignState.vehiculoId === null) {
      setAssignState((s) => ({
        ...s,
        vehiculoId: lastVehiculo.id,
        centroCosteId: lastVehiculo.centroCosteId ?? s.centroCosteId,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiculos, assignState.categoria]);

  useEffect(() => {
    if (centros.length === 0) return;
    const lastCentro = getLastUsed(CENTRO_KEY, centros);
    if (lastCentro && assignState.centroCosteId === null) {
      setAssignState((s) => ({ ...s, centroCosteId: lastCentro.id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centros]);

  useEffect(() => {
    if (tarjetas.length === 1 && assignState.tarjetaId === null) {
      setAssignState((s) => ({ ...s, tarjetaId: tarjetas[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarjetas]);

  const selectedVehiculo = vehiculos.find((v) => v.id === assignState.vehiculoId) ?? null;
  const selectedCentro = centros.find((c) => c.id === assignState.centroCosteId) ?? null;
  const selectedTarjeta = tarjetas.find((t) => t.id === assignState.tarjetaId) ?? null;

  const recentVehiculos = getRecentItems(vehiculoKey(assignState.categoria), vehiculos, 3);
  const recentCentros = getRecentItems(CENTRO_KEY, centros, 3);

  const canContinue =
    assignState.vehiculoId !== null &&
    assignState.tarjetaId !== null &&
    assignState.centroCosteId !== null;

  function handleCategoriaChange(c: Categoria) {
    setAssignState((s) => ({ ...s, categoria: c, vehiculoId: null }));
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-5 px-4 py-4">
        <p className="text-base font-bold text-foreground">
          Selecciona la asignación
        </p>

        {/* Tipo */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tipo de gasto
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleCategoriaChange("VEHICULO")}
              className={cn(
                "flex h-14 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors",
                assignState.categoria === "VEHICULO"
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
                assignState.categoria === "INDUSTRIAL_MAQUINARIA"
                  ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              <Hammer className="size-4" />
              Industrial
            </button>
          </div>
        </div>

        {/* Vehículo */}
        <SearchableSheetSelect<Vehiculo>
          label={assignState.categoria === "VEHICULO" ? "Vehículo" : "Maquinaria"}
          required
          title={
            assignState.categoria === "VEHICULO"
              ? "Selecciona vehículo"
              : "Selecciona maquinaria"
          }
          value={selectedVehiculo}
          onChange={(v) =>
            setAssignState((s) => ({
              ...s,
              vehiculoId: v.id,
              centroCosteId: v.centroCosteId ?? s.centroCosteId,
            }))
          }
          items={vehiculos}
          emptyMessage={
            assignState.categoria === "VEHICULO"
              ? "No hay vehículos disponibles"
              : "No hay maquinaria disponible"
          }
          searchPlaceholder={
            assignState.categoria === "VEHICULO"
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
            <VehiculoTrigger vehiculo={v} categoria={assignState.categoria} />
          )}
          renderItem={(v, isSelected) => (
            <VehiculoItem
              vehiculo={v}
              categoria={assignState.categoria}
              isSelected={isSelected}
            />
          )}
        />

        {/* Centro de coste */}
        <SearchableSheetSelect<CentroCoste>
          label="Centro de coste"
          title="Selecciona centro de coste"
          value={selectedCentro}
          onChange={(c) =>
            setAssignState((s) => ({ ...s, centroCosteId: c.id }))
          }
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

        {/* Tarjeta */}
        {tarjetas.length === 1 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
            onChange={(t) =>
              setAssignState((s) => ({ ...s, tarjetaId: t.id }))
            }
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

        {/* Kilómetros — solo VEHICULO */}
        {assignState.categoria === "VEHICULO" && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Kilómetros (opcional)
            </p>
            <input
              type="number"
              value={assignState.kilometros}
              onChange={(e) =>
                setAssignState((s) => ({ ...s, kilometros: e.target.value }))
              }
              placeholder="Ej: 45320"
              inputMode="numeric"
              className="h-14 rounded-xl border border-border bg-input px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2 pb-4">
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

// ─── Field component ─────────────────────────────────────────────────────────

function OcrField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  suffix,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number";
  placeholder?: string;
  suffix?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </p>
      <div className="relative">
        <input
          type={type}
          inputMode={type === "number" ? "decimal" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "h-14 w-full rounded-xl border border-primary/25 bg-primary/5 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
            suffix && "pr-14",
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Step 5 — OCR + Edit (2-in-1) ────────────────────────────────────────────

type OcrSubState = "loading" | "ready" | "error";

function OcrAndEditStep({
  imageBlob,
  assignState,
  tarjeta,
  onBack,
  onSuccess,
  onSaveRecents,
}: {
  imageBlob: Blob;
  assignState: AssignState;
  tarjeta: Tarjeta;
  onBack: () => void;
  onSuccess: (result: OcrResponse, ocrData: EditableOcrData) => void;
  onSaveRecents: () => void;
}) {
  const [subState, setSubState] = useState<OcrSubState>("loading");
  const [ocrData, setOcrData] = useState<EditableOcrData>(emptyEditable());
  const [submitError, setSubmitError] = useState<string | null>(null);

  // OCR preview mutation — fires on mount (FLEET-01: ya no envia PIN)
  const ocrPreviewMutation = useMutation<OcrPreviewData, Error, void>({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("imagen", imageBlob, "ticket.jpg");
      return apiClient.upload<OcrPreviewData>(
        `/tickets/ocr-preview?tarjetaId=${assignState.tarjetaId}`,
        formData,
      );
    },
    onSuccess: (data) => {
      setOcrData(previewToEditable(data));
      setSubState("ready");
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Error al procesar el ticket. Inténtalo de nuevo.",
      );
      setSubState("error");
    },
  });

  // Submit mutation
  const submitMutation = useMutation<OcrResponse, Error, void>({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("imagen", imageBlob, "ticket.jpg");

      const params: Record<string, unknown> = {
        tarjetaId: tarjeta.id,
        categoriaRecurso: assignState.categoria,
        vehiculoId: assignState.vehiculoId,
        // OCR fields
        estacion: ocrData.estacion,
        fechaHora: ocrData.fechaHora || undefined,
        importeTotal: ocrData.importeTotal ? Number(ocrData.importeTotal) : undefined,
        litros: ocrData.litros ? Number(ocrData.litros) : undefined,
        precioLitro: ocrData.precioLitro ? Number(ocrData.precioLitro) : undefined,
        producto: ocrData.producto || undefined,
        numRecibo: ocrData.numRecibo || undefined,
        matricula: ocrData.matricula || undefined,
        ocrRaw: ocrData.ocrRaw || undefined,
      };
      if (assignState.centroCosteId) params.centroCosteId = assignState.centroCosteId;
      if (assignState.kilometros) params.kilometros = Number(assignState.kilometros);

      const paramsBlob = new Blob([JSON.stringify(params)], {
        type: "application/json",
      });
      formData.append("params", paramsBlob);
      return apiClient.upload<OcrResponse>("/tickets/ocr-validado", formData);
    },
    onSuccess: async (data) => {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(50);
      }
      onSaveRecents();
      onSuccess(data, ocrData);
    },
    onError: (err) => {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([50, 50, 50]);
      }
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Error al enviar el ticket. Inténtalo de nuevo.",
      );
    },
  });

  // Fire OCR on mount
  useEffect(() => {
    ocrPreviewMutation.mutate();
    // intentional single-fire — deps intentionally empty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField<K extends keyof EditableOcrData>(key: K, val: string) {
    setOcrData((d) => ({ ...d, [key]: val }));
  }

  const canSubmit =
    ocrData.estacion.trim() !== "" && ocrData.importeTotal.trim() !== "";

  // ── Loading sub-state ──────────────────────────────────────────────────────
  if (subState === "loading") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
        <div className="relative flex size-20 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="size-8 text-primary animate-pulse" />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-base font-bold text-foreground">
            Procesando ticket con IA...
          </p>
          <p className="text-sm text-muted-foreground">
            Extrayendo datos del ticket automáticamente
          </p>
        </div>
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  // ── Error sub-state ────────────────────────────────────────────────────────
  if (subState === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        <AlertCircle className="size-12 text-destructive" />
        <p className="text-base font-semibold text-foreground">
          Error al procesar el ticket
        </p>
        <p className="text-sm text-muted-foreground">
          No se pudo extraer información del ticket. Inténtalo de nuevo.
        </p>
        <button
          onClick={() => {
            setSubState("loading");
            ocrPreviewMutation.mutate();
          }}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-md shadow-primary/30 transition-all hover:bg-primary/90"
        >
          Reintentar
        </button>
        <button
          onClick={onBack}
          className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
        >
          Volver al PIN
        </button>
      </div>
    );
  }

  // ── Ready sub-state — editable form ───────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-5 px-4 py-4">
        {/* OCR fields section */}
        <div className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4">
          {/* Header badge */}
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <p className="text-xs font-semibold text-primary">
              Datos extraídos por IA · revisa y edita si es necesario
            </p>
          </div>

          <OcrField
            label="Estación"
            required
            value={ocrData.estacion}
            onChange={(v) => setField("estacion", v)}
            placeholder="Nombre de la estación"
          />

          <OcrField
            label="Fecha y hora"
            value={ocrData.fechaHora}
            onChange={(v) => setField("fechaHora", v)}
            type="text"
            placeholder="2026-01-29T10:05:00"
          />

          <OcrField
            label="Importe total"
            required
            value={ocrData.importeTotal}
            onChange={(v) => setField("importeTotal", v)}
            type="number"
            placeholder="0.00"
            suffix="€"
          />

          <OcrField
            label="Litros"
            value={ocrData.litros}
            onChange={(v) => setField("litros", v)}
            type="number"
            placeholder="—"
            suffix="L"
          />

          <OcrField
            label="Precio / L"
            value={ocrData.precioLitro}
            onChange={(v) => setField("precioLitro", v)}
            type="number"
            placeholder="—"
            suffix="€/L"
          />

          <OcrField
            label="Producto"
            value={ocrData.producto}
            onChange={(v) => setField("producto", v)}
            placeholder="Diésel, Gasolina 95..."
          />

          <OcrField
            label="Nº recibo"
            value={ocrData.numRecibo}
            onChange={(v) => setField("numRecibo", v)}
            placeholder="—"
          />

          <OcrField
            label="Matrícula detectada"
            value={ocrData.matricula}
            onChange={(v) => setField("matricula", v)}
            placeholder="—"
          />
        </div>

        {/* Submit error */}
        {submitError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{submitError}</p>
          </div>
        )}

        {submitMutation.isPending && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Enviando ticket...
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2 pb-4">
          <button
            onClick={onBack}
            disabled={submitMutation.isPending}
            className="flex h-12 flex-1 items-center justify-center rounded-xl border border-border text-sm font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98] disabled:opacity-50"
          >
            Atrás
          </button>
          <button
            onClick={() => {
              setSubmitError(null);
              submitMutation.mutate();
            }}
            disabled={submitMutation.isPending || !canSubmit}
            className={cn(
              "flex h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/30",
              "transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {submitMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CloudUpload className="size-4" />
            )}
            {submitMutation.isPending ? "Enviando..." : "Enviar ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Success view ─────────────────────────────────────────────────────────────

interface OcrDisplayField {
  label: string;
  value: string | null;
}

function SuccessView({
  result,
  tarjeta,
  ocrData,
  onHome,
  onScanAnother,
}: {
  result: OcrResponse;
  tarjeta: Tarjeta | null;
  ocrData: EditableOcrData;
  onHome: () => void;
  onScanAnother: () => void;
}) {
  const fields: OcrDisplayField[] = [
    { label: "Estación", value: ocrData.estacion || null },
    { label: "Fecha y hora", value: ocrData.fechaHora || null },
    { label: "Producto", value: ocrData.producto || null },
    {
      label: "Litros",
      value: ocrData.litros ? formatLitros(Number(ocrData.litros)) : null,
    },
    {
      label: "Precio/L",
      value: ocrData.precioLitro
        ? formatPrecioLitro(Number(ocrData.precioLitro))
        : null,
    },
    {
      label: "Importe",
      value: ocrData.importeTotal
        ? formatCurrency(Number(ocrData.importeTotal))
        : null,
    },
    { label: "Matrícula", value: ocrData.matricula || null },
    { label: "Nº recibo", value: ocrData.numRecibo || null },
  ].filter((f): f is { label: string; value: string } => f.value !== null);

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
              Datos del ticket
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
  const [step, setStep] = useState<Step>("camera");
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [ocrResult, setOcrResult] = useState<OcrResponse | null>(null);
  const [finalOcrData, setFinalOcrData] = useState<EditableOcrData>(emptyEditable());

  const [assignState, setAssignState] = useState<AssignState>({
    categoria: "VEHICULO",
    vehiculoId: null,
    centroCosteId: null,
    tarjetaId: null,
    kilometros: "",
  });

  // Fetch tarjetas — needed at assignment step onwards
  const { data: tarjetas = [] } = useQuery<Tarjeta[]>({
    queryKey: ["mis-tarjetas"],
    queryFn: () => apiClient.get<Tarjeta[]>("/tarjetas/mis-tarjetas"),
    enabled: step === "assignment" || step === "ocr-edit",
  });

  const selectedTarjeta =
    tarjetas.find((t) => t.id === assignState.tarjetaId) ?? null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleCapture(blob: Blob, previewUrl: string) {
    setImageBlob(blob);
    setPreview(previewUrl);
    setStep("image-preview");
  }

  function handleBack() {
    switch (step) {
      case "camera":
        router.back();
        break;
      case "image-preview":
        setStep("camera");
        break;
      case "assignment":
        setStep("image-preview");
        break;
      case "ocr-edit":
        setStep("assignment");
        break;
      default:
        break;
    }
  }

  function handleSaveRecents() {
    if (assignState.vehiculoId !== null) {
      addRecent(vehiculoKey(assignState.categoria), assignState.vehiculoId);
    }
    if (assignState.centroCosteId !== null) {
      addRecent(CENTRO_KEY, assignState.centroCosteId);
    }
  }

  function handleScanAnother() {
    setOcrResult(null);
    setFinalOcrData(emptyEditable());
    setImageBlob(null);
    setPreview("");
    setAssignState({
      categoria: "VEHICULO",
      vehiculoId: null,
      centroCosteId: null,
      tarjetaId: null,
      kilometros: "",
    });
    setStep("camera");
  }

  // ── Success view ─────────────────────────────────────────────────────────

  if (step === "success" && ocrResult) {
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
            ocrData={finalOcrData}
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
        {step === "camera" && <CameraStep onCapture={handleCapture} />}

        {step === "image-preview" && (
          <ImagePreviewStep
            preview={preview}
            onBack={() => setStep("camera")}
            onContinue={() => setStep("assignment")}
          />
        )}

        {step === "assignment" && (
          <AssignmentStep
            assignState={assignState}
            setAssignState={setAssignState}
            onBack={() => setStep("image-preview")}
            onContinue={() => setStep("ocr-edit")}
          />
        )}

        {step === "ocr-edit" && imageBlob && selectedTarjeta && (
          <OcrAndEditStep
            imageBlob={imageBlob}
            assignState={assignState}
            tarjeta={selectedTarjeta}
            onBack={() => setStep("assignment")}
            onSuccess={(result, ocrData) => {
              setOcrResult(result);
              setFinalOcrData(ocrData);
              setStep("success");
            }}
            onSaveRecents={handleSaveRecents}
          />
        )}
      </div>
    </div>
  );
}

