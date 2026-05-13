"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Fingerprint,
  AlertCircle,
  CheckCircle,
  Loader2,
  ShieldCheck,
  Trash2,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { PinInput } from "@/components/shared/pin-input";
import { apiClient, ApiError } from "@/lib/api-client";
import { savePinLocal, removePinLocal } from "@/lib/pin-storage";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tarjeta {
  id: number;
  numeroTarjetaUltimos4: string;
  alias?: string | null;
  proveedor?: string;
  tienePinGuardado: boolean;
}

type BiometricState = "idle" | "pending" | "passed" | "failed" | "cancelled";
type PinMode = "set" | "change";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function checkBiometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !("PublicKeyCredential" in window)) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

async function requestBiometric(): Promise<void> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  await navigator.credentials.get({
    publicKey: {
      challenge,
      userVerification: "required",
      timeout: 30_000,
    },
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PinPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tarjetaIdStr = params.id;
  const tarjetaId = Number(tarjetaIdStr);

  // Optionally accept ?mode=change to force change mode even if no pin saved
  const forcedMode = searchParams.get("mode") as PinMode | null;

  // Fetch tarjeta to know if it has a saved PIN
  const { data: tarjeta, isLoading: loadingTarjeta } = useQuery<Tarjeta>({
    queryKey: ["tarjeta", tarjetaIdStr],
    queryFn: () => apiClient.get<Tarjeta>(`/tarjetas/${tarjetaIdStr}`),
  });

  const hasSavedPin = tarjeta?.tienePinGuardado ?? false;
  const showBiometricFlow = hasSavedPin && forcedMode !== "set";

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricState, setBiometricState] = useState<BiometricState>("idle");

  const [pinMode, setPinMode] = useState<PinMode>("set");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    checkBiometricAvailable().then(setBiometricAvailable);
  }, []);

  // When tarjeta loads and has saved PIN → auto-trigger biometric
  useEffect(() => {
    if (tarjeta && showBiometricFlow && biometricState === "idle") {
      handleBiometricVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarjeta?.tienePinGuardado]);

  // ── Save PIN mutation ─────────────────────────────────────────────────────

  const saveMutation = useMutation<void, Error, string>({
    mutationFn: async (pinValue: string) => {
      await apiClient.post(`/tarjetas/${tarjetaIdStr}/pin`, { pin: pinValue });
    },
    onSuccess: (_, pinValue) => {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(50);
      }
      savePinLocal(tarjetaId, pinValue);
      setSuccess(true);
      toast.success("PIN guardado correctamente");
      setTimeout(() => router.push("/tarjetas"), 1500);
    },
    onError: (err) => {
      const message =
        err instanceof ApiError && err.status === 401
          ? "PIN incorrecto. Inténtalo de nuevo."
          : err instanceof ApiError
          ? err.message
          : "Error al guardar el PIN";
      setError(message);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([50, 50, 50]);
      }
    },
  });

  // ── Remove PIN mutation ───────────────────────────────────────────────────

  const removeMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      // POST with empty pin to clear, or DELETE if backend supports it
      await apiClient.post(`/tarjetas/${tarjetaIdStr}/pin`, { pin: "" });
    },
    onSuccess: () => {
      removePinLocal(tarjetaId);
      toast.success("PIN eliminado");
      router.push("/tarjetas");
    },
    onError: (err) => {
      // If backend doesn't accept empty pin, just clear sessionStorage
      removePinLocal(tarjetaId);
      if (err instanceof ApiError && err.status !== 400) {
        toast.error(
          err instanceof ApiError ? err.message : "Error al eliminar el PIN",
        );
      } else {
        // Treat as success — sessionStorage cleared
        toast.success("PIN eliminado localmente");
        router.push("/tarjetas");
      }
    },
  });

  // ── Biometric ────────────────────────────────────────────────────────────

  async function handleBiometricVerify() {
    setBiometricState("pending");
    setError(null);
    try {
      await requestBiometric();
      setBiometricState("passed");
    } catch {
      setBiometricState("cancelled");
    }
  }

  // ── Submit PIN ────────────────────────────────────────────────────────────

  function handleSubmit() {
    setError(null);
    if (pin.length < 4) {
      setError("Introduce los 4 dígitos del PIN");
      return;
    }
    saveMutation.mutate(pin);
  }

  // ─── Loading state ────────────────────────────────────────────────────────

  if (loadingTarjeta) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  // ─── Success view ─────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-success/15 border border-success/30">
            <CheckCircle className="size-10 text-success" />
          </div>
          <p className="text-xl font-bold text-foreground">PIN guardado</p>
          <p className="text-sm text-muted-foreground">
            El PIN ha sido guardado correctamente.
          </p>
        </div>
      </div>
    );
  }

  // ─── Card header ─────────────────────────────────────────────────────────

  const cardLabel = tarjeta
    ? (tarjeta.alias ?? `Tarjeta ${tarjeta.proveedor ?? ""}`)
    : `Tarjeta #${tarjetaIdStr}`;
  const cardLast4 = tarjeta?.numeroTarjetaUltimos4 ?? "????";

  // ─── Branch: tarjeta HAS saved PIN → biometric gate ──────────────────────

  if (showBiometricFlow) {
    // 1. Pending / requesting biometric
    if (biometricState === "idle" || biometricState === "pending") {
      return (
        <div className="flex min-h-screen flex-col bg-background">
          <div className="mx-auto w-full max-w-[480px]">
            <PageHeader title="PIN de tarjeta" />
            <div className="flex flex-col items-center gap-6 px-6 pt-16 pb-6 text-center">
              <div className="flex size-20 items-center justify-center rounded-full bg-primary/10">
                <Fingerprint className="size-10 text-primary animate-pulse" />
              </div>
              <p className="text-base font-semibold text-foreground">
                Verificando identidad...
              </p>
              <p className="text-sm text-muted-foreground">
                Usa la biometría del dispositivo para acceder al PIN guardado.
              </p>
              {biometricState === "pending" && (
                <Loader2 className="size-6 animate-spin text-primary" />
              )}
            </div>
          </div>
        </div>
      );
    }

    // 2. Biometric failed / cancelled
    if (biometricState === "failed" || biometricState === "cancelled") {
      return (
        <div className="flex min-h-screen flex-col bg-background">
          <div className="mx-auto w-full max-w-[480px]">
            <PageHeader title="PIN de tarjeta" />
            <div className="flex flex-col items-center gap-6 px-6 pt-12 pb-6 text-center">
              <div className="flex size-20 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="size-10 text-destructive" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">
                  Verificación cancelada
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  No se pudo verificar tu identidad con biometría.
                </p>
              </div>
              <div className="flex w-full flex-col gap-3">
                <button
                  onClick={handleBiometricVerify}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/30 transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
                >
                  <Fingerprint className="size-4" />
                  Reintentar
                </button>
                <button
                  onClick={() => router.back()}
                  className="flex h-12 w-full items-center justify-center rounded-xl border border-border text-sm font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
                >
                  Volver
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 3. Biometric passed → show management UI
    if (biometricState === "passed") {
      // If user wants to change PIN
      if (pinMode === "change") {
        return (
          <div className="flex min-h-screen flex-col bg-background">
            <div className="mx-auto w-full max-w-[480px]">
              <PageHeader title="Cambiar PIN" />
              <div className="flex flex-col items-center gap-6 px-6 pt-10 pb-6">
                <CardBadge label={cardLabel} last4={cardLast4} />

                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="text-lg font-bold text-foreground">Nuevo PIN</p>
                  <p className="text-sm text-muted-foreground">
                    Introduce los 4 nuevos dígitos para esta tarjeta.
                  </p>
                </div>

                <PinInput
                  value={pin}
                  onChange={(v) => {
                    setPin(v);
                    if (error) setError(null);
                  }}
                  disabled={saveMutation.isPending}
                  error={!!error}
                />

                {error && <ErrorBanner message={error} />}

                <button
                  onClick={handleSubmit}
                  disabled={pin.length < 4 || saveMutation.isPending}
                  className={cn(
                    "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/30",
                    "transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  {saveMutation.isPending && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {saveMutation.isPending ? "Guardando..." : "Guardar nuevo PIN"}
                </button>

                <button
                  onClick={() => { setPinMode("set"); setPin(""); setError(null); }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      }

      // Default: show current PIN info + management options
      return (
        <div className="flex min-h-screen flex-col bg-background">
          <div className="mx-auto w-full max-w-[480px]">
            <PageHeader title="PIN de tarjeta" />
            <div className="flex flex-col items-center gap-6 px-6 pt-10 pb-6">

              {/* Verified badge */}
              <div className="flex items-center gap-2 rounded-full bg-success/10 px-4 py-2">
                <ShieldCheck className="size-4 text-success" />
                <span className="text-sm font-semibold text-success">
                  Identidad verificada
                </span>
              </div>

              <CardBadge label={cardLabel} last4={cardLast4} />

              {/* PIN display (masked) */}
              <div className="flex flex-col items-center gap-3 w-full rounded-2xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  PIN actual
                </p>
                <div className="flex items-center gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex size-14 items-center justify-center rounded-xl border-2 border-primary/30 bg-primary/5"
                    >
                      <div className="size-3 rounded-full bg-primary/60" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  El PIN está guardado de forma segura en el servidor
                </p>
              </div>

              {/* Actions */}
              <div className="flex w-full flex-col gap-3">
                <button
                  onClick={() => { setPinMode("change"); setPin(""); setError(null); }}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/30 transition-all hover:bg-primary/90 active:scale-[0.98]"
                >
                  <KeyRound className="size-4" />
                  Cambiar PIN
                </button>

                <button
                  onClick={() => {
                    if (confirm("¿Eliminar el PIN guardado? Tendrás que introducirlo manualmente en cada operación.")) {
                      removeMutation.mutate();
                    }
                  }}
                  disabled={removeMutation.isPending}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 active:scale-[0.98] disabled:opacity-50"
                >
                  {removeMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Eliminar PIN guardado
                </button>

                <button
                  onClick={() => router.back()}
                  className="text-sm text-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  Volver
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  // ─── Branch: tarjeta does NOT have saved PIN → direct input ──────────────

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto w-full max-w-[480px]">
        <PageHeader title="PIN de tarjeta" />

        <div className="flex flex-col items-center gap-6 px-6 pt-10 pb-6">
          <CardBadge label={cardLabel} last4={cardLast4} />

          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-lg font-bold text-foreground">Introduce tu PIN</p>
            <p className="text-sm text-muted-foreground">
              Introduce los 4 dígitos para autorizar el uso de esta tarjeta.
            </p>
          </div>

          {/* Biometric shortcut if available (but no saved PIN) */}
          {biometricAvailable && (
            <>
              <button
                onClick={async () => {
                  try {
                    await requestBiometric();
                    if (pin.length === 4) {
                      saveMutation.mutate(pin);
                    } else {
                      toast.info(
                        "Verificación completada. Introduce el PIN para guardar.",
                      );
                    }
                  } catch {
                    toast.info("Verificación cancelada.");
                  }
                }}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
              >
                <Fingerprint className="size-4" />
                Usar biometría del dispositivo
              </button>

              <div className="flex w-full items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">
                  o introduce el PIN
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </>
          )}

          <PinInput
            value={pin}
            onChange={(v) => {
              setPin(v);
              if (error) setError(null);
            }}
            disabled={saveMutation.isPending}
            error={!!error}
          />

          {error && <ErrorBanner message={error} />}

          <button
            onClick={handleSubmit}
            disabled={pin.length < 4 || saveMutation.isPending}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/30",
              "transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {saveMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {saveMutation.isPending ? "Guardando..." : "Guardar PIN"}
          </button>

          <button
            onClick={() => router.back()}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function PageHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <header className="flex items-center gap-3 border-b border-border px-4 py-3">
      <button
        onClick={() => router.back()}
        className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-muted"
        aria-label="Volver"
      >
        <ArrowLeft className="size-5 text-foreground" />
      </button>
      <h1 className="text-base font-bold text-foreground">{title}</h1>
    </header>
  );
}

function CardBadge({ label, last4 }: { label: string; last4: string }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <span className="text-lg">💳</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs tracking-widest text-muted-foreground">
          **** {last4}
        </p>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex w-full items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}
