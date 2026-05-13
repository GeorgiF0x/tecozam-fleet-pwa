"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Fingerprint, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PinInput } from "@/components/shared/pin-input";
import { apiClient, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PinPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tarjetaId = params.id;

  const [pin, setPin] = useState("");
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check biometric availability on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "PublicKeyCredential" in window) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => setBiometricAvailable(available))
        .catch(() => setBiometricAvailable(false));
    }
  }, []);

  const mutation = useMutation<void, Error, string>({
    mutationFn: async (pinValue: string) => {
      await apiClient.post(`/tarjetas/${tarjetaId}/pin`, { pin: pinValue });
    },
    onSuccess: () => {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(50);
      }
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

  function handleSubmit() {
    setError(null);
    if (pin.length < 4) {
      setError("Introduce los 4 dígitos del PIN");
      return;
    }
    mutation.mutate(pin);
  }

  async function handleBiometric() {
    setError(null);
    try {
      // Simple platform authenticator verification (no actual credential creation needed —
      // we just want to verify the user is present via device biometrics)
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Tecozam Fleet", id: window.location.hostname },
          user: {
            id: new Uint8Array(16),
            name: "operario",
            displayName: "Operario",
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 30_000,
        },
      });
      // If we reach here, biometric verification passed — submit with current pin
      if (pin.length === 4) {
        mutation.mutate(pin);
      } else {
        toast.info("Verificación biométrica completada. Introduce el PIN para continuar.");
      }
    } catch {
      // Biometric failed or cancelled — allow manual entry
      setError(null);
      toast.info("Verificación biométrica cancelada. Introduce el PIN manualmente.");
    }
  }

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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto w-full max-w-[480px]">

        {/* Header */}
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-muted"
            aria-label="Volver"
          >
            <ArrowLeft className="size-5 text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">PIN de tarjeta</h1>
        </header>

        {/* Content */}
        <div className="flex flex-col items-center gap-6 px-6 pt-10 pb-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-lg font-bold text-foreground">Introduce tu PIN</p>
            <p className="text-sm text-muted-foreground">
              Introduce los 4 dígitos para autorizar el uso de esta tarjeta.
            </p>
          </div>

          {/* Biometric button (if available) */}
          {biometricAvailable && (
            <button
              onClick={handleBiometric}
              disabled={mutation.isPending}
              className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
            >
              <Fingerprint className="size-4" />
              Usar biometría del dispositivo
            </button>
          )}

          {biometricAvailable && (
            <div className="flex w-full items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">o introduce el PIN</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}

          {/* PIN input */}
          <PinInput
            value={pin}
            onChange={(v) => {
              setPin(v);
              if (error) setError(null);
            }}
            disabled={mutation.isPending}
            error={!!error}
          />

          {/* Error */}
          {error && (
            <div className="flex w-full items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={pin.length < 4 || mutation.isPending}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/30",
              "transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {mutation.isPending ? "Guardando..." : "Guardar PIN"}
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
