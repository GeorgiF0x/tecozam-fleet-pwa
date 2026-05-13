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
} from "lucide-react";
import { toast } from "sonner";
import { PinInput } from "@/components/shared/pin-input";
import { apiClient, ApiError } from "@/lib/api-client";
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

interface OcrResponse {
  status?: string;
  ticketId?: number;
  message?: string;
  estacion?: string;
  importe?: number;
  litros?: number;
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
                  active ? "text-primary" : done ? "text-success" : "text-muted-foreground",
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

function CameraStep({ onCapture }: { onCapture: (blob: Blob, preview: string) => void }) {
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
    // Try to toggle torch track if available
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      const cap = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
      if (cap.torch) {
        track.applyConstraints({ advanced: [{ torch: !flash } as MediaTrackConstraintSet] }).catch(() => {});
      }
    }
  }

  if (cameraError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        <Camera className="size-14 text-muted-foreground" />
        <p className="text-base font-semibold text-foreground">Sin acceso a la cámara</p>
        <p className="text-sm text-muted-foreground">
          No se pudo acceder a la cámara. Permite el acceso en la configuración del navegador o usa la galería.
        </p>
        <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-md shadow-primary/30 transition-all hover:bg-primary/90">
          <Images className="size-4" />
          Seleccionar de galería
          <input type="file" accept="image/*" onChange={handleGallery} className="sr-only" />
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
        {/* Dark vignette around frame */}
        <div className="absolute inset-0 bg-black/40" style={{
          maskImage: "radial-gradient(ellipse 65% 70% at center, transparent 0%, black 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 65% 70% at center, transparent 0%, black 100%)",
        }} />

        {/* Corner guide */}
        <div className="relative h-72 w-56">
          {/* TL */}
          <span className="absolute left-0 top-0 h-6 w-6 border-l-[3px] border-t-[3px] border-primary rounded-tl-md" />
          {/* TR */}
          <span className="absolute right-0 top-0 h-6 w-6 border-r-[3px] border-t-[3px] border-primary rounded-tr-md" />
          {/* BL */}
          <span className="absolute bottom-0 left-0 h-6 w-6 border-b-[3px] border-l-[3px] border-primary rounded-bl-md" />
          {/* BR */}
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
          {flash ? <Zap className="size-4 text-warning" /> : <ZapOff className="size-4" />}
        </button>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-8 pb-6 pt-10">
        {/* Gallery */}
        <label className="flex cursor-pointer flex-col items-center gap-1">
          <div className="flex size-12 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
            <Images className="size-5 text-white" />
          </div>
          <span className="text-[10px] text-white/70">Galería</span>
          <input type="file" accept="image/*" onChange={handleGallery} className="sr-only" />
        </label>

        {/* Capture button */}
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

        {/* Spacer */}
        <div className="size-12" />
      </div>
    </div>
  );
}

// ─── Step 2 — Preview + form ─────────────────────────────────────────────────

interface Step2State {
  categoria: Categoria;
  vehiculoId: number | null;
  centroCosteId: number | null;
  tarjetaId: number | null;
  kilometros: string;
}

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
      apiClient.get<Vehiculo[]>(`/vehiculos?activo=true&categoria=${state.categoria}`),
  });

  const { data: centros = [] } = useQuery<CentroCoste[]>({
    queryKey: ["centros-coste"],
    queryFn: () => apiClient.get<CentroCoste[]>("/centros-coste?activo=true"),
  });

  const { data: tarjetas = [] } = useQuery<Tarjeta[]>({
    queryKey: ["mis-tarjetas"],
    queryFn: () => apiClient.get<Tarjeta[]>("/tarjetas/mis-tarjetas"),
  });

  const canContinue = state.vehiculoId !== null && state.tarjetaId !== null;

  function handleCategoriaChange(c: Categoria) {
    setState((s) => ({ ...s, categoria: c, vehiculoId: null }));
  }

  function handleVehiculoSelect(id: number) {
    setState((s) => {
      const v = vehiculos.find((v) => v.id === id);
      return {
        ...s,
        vehiculoId: id,
        centroCosteId: v?.centroCosteId ?? s.centroCosteId,
      };
    });
  }

  const selectedVehiculo = vehiculos.find((v) => v.id === state.vehiculoId);

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

        {/* Tipo de gasto */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tipo de gasto
          </p>
          <div className="flex gap-2">
            {(["VEHICULO", "INDUSTRIAL_MAQUINARIA"] as Categoria[]).map((c) => (
              <button
                key={c}
                onClick={() => handleCategoriaChange(c)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition-colors",
                  state.categoria === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {c === "VEHICULO" ? "Vehículo" : "Maquinaria"}
              </button>
            ))}
          </div>
        </div>

        {/* Vehículo / Maquinaria */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {state.categoria === "VEHICULO" ? "Vehículo" : "Maquinaria"}
          </p>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {vehiculos.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Sin resultados</p>
            ) : (
              vehiculos.map((v, idx) => (
                <button
                  key={v.id}
                  onClick={() => handleVehiculoSelect(v.id)}
                  className={cn(
                    "flex w-full items-center justify-between px-4 py-3 text-left transition-colors",
                    idx < vehiculos.length - 1 && "border-b border-border",
                    state.vehiculoId === v.id ? "bg-primary/10" : "hover:bg-muted/50",
                  )}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{v.nombre ?? `#${v.id}`}</p>
                    <p className="text-xs text-muted-foreground tracking-widest">
                      {state.categoria === "VEHICULO"
                        ? (v.matricula ?? "Sin matrícula")
                        : (v.codigoObra ?? "Sin código")}
                    </p>
                  </div>
                  {state.vehiculoId === v.id && (
                    <CheckCircle className="size-4 shrink-0 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Kilómetros — only for vehicles */}
        {state.categoria === "VEHICULO" && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Kilómetros (opcional)
            </p>
            <input
              type="number"
              value={state.kilometros}
              onChange={(e) => setState((s) => ({ ...s, kilometros: e.target.value }))}
              placeholder="Ej: 45320"
              inputMode="numeric"
              className="h-12 rounded-xl border border-border bg-input px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
        )}

        {/* Centro de coste */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Centro de coste
          </p>
          <select
            value={state.centroCosteId ?? ""}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                centroCosteId: e.target.value ? Number(e.target.value) : null,
              }))
            }
            className="h-12 rounded-xl border border-border bg-input px-4 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            <option value="">Seleccionar centro de coste</option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Tarjeta */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tarjeta de combustible
          </p>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {tarjetas.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Sin tarjetas asignadas</p>
            ) : (
              tarjetas.map((t, idx) => (
                <button
                  key={t.id}
                  onClick={() => setState((s) => ({ ...s, tarjetaId: t.id }))}
                  className={cn(
                    "flex w-full items-center justify-between px-4 py-3 text-left transition-colors",
                    idx < tarjetas.length - 1 && "border-b border-border",
                    state.tarjetaId === t.id ? "bg-primary/10" : "hover:bg-muted/50",
                  )}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t.alias ?? `Tarjeta ${t.proveedor ?? ""}`}
                    </p>
                    <p className="text-xs text-muted-foreground tracking-widest">
                      **** {t.numeroTarjetaUltimos4}
                    </p>
                  </div>
                  {state.tarjetaId === t.id && (
                    <CheckCircle className="size-4 shrink-0 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

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
}: {
  tarjeta: Tarjeta;
  onBack: () => void;
  onSuccess: (result: OcrResponse) => void;
  imageBlob: Blob;
  step2State: Step2State;
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

      formData.append("params", JSON.stringify(params));
      return apiClient.upload<OcrResponse>("/tickets/ocr-validado", formData);
    },
    onSuccess: (data) => {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(50);
      }
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
          <span className="text-xs text-muted-foreground">o introduce el PIN</span>
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

function SuccessView({ result, onHome }: { result: OcrResponse; onHome: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
      <div className="flex size-24 items-center justify-center rounded-full bg-success/15 border border-success/30">
        <CheckCircle className="size-12 text-success" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">Ticket enviado</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu ticket ha sido registrado correctamente.
        </p>
      </div>

      {/* OCR data if available */}
      {(result.estacion || result.importe) && (
        <div className="w-full rounded-xl border border-border bg-card p-4 text-left">
          {result.estacion && (
            <div className="flex justify-between py-1.5">
              <span className="text-xs text-muted-foreground">Estación</span>
              <span className="text-xs font-semibold text-foreground">{result.estacion}</span>
            </div>
          )}
          {result.importe != null && (
            <div className="flex justify-between border-t border-border py-1.5">
              <span className="text-xs text-muted-foreground">Importe</span>
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(result.importe)}
              </span>
            </div>
          )}
        </div>
      )}

      <button
        onClick={onHome}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/30 transition-all hover:bg-primary/90 active:scale-[0.98]"
      >
        <Home className="size-4" />
        Volver al inicio
      </button>
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

  const selectedTarjeta = tarjetas.find((t) => t.id === step2State.tarjetaId);

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

  if (done && ocrResult) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col">
          <SuccessView result={ocrResult} onHome={() => router.push("/")} />
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
          />
        )}

        {/* Fallback if tarjeta not found at step 3 */}
        {step === 3 && !selectedTarjeta && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <AlertCircle className="size-10 text-destructive" />
            <p className="text-sm text-muted-foreground">
              No se encontró la tarjeta seleccionada. Vuelve al paso anterior.
            </p>
            <button onClick={() => setStep(2)} className="text-sm font-semibold text-primary">
              Volver
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
