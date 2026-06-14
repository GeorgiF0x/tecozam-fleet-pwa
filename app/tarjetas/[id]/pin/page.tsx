"use client";

// ─── /tarjetas/[id]/pin — Reescritura SDD pin-biometric-view ─────────────────
// Flujo:
//   1) Carga `tarjeta` y `usuarioCampoMe` (incluye flag webauthnEnabled).
//   2) Si la tarjeta NO tiene PIN guardado → modo "set": el operario lo guarda
//      con su flujo PinInput. Al éxito, redirige a /tarjetas.
//   3) Si ya tiene PIN → modo "reveal":
//        - Botón "Ver con biometría" → flujo WebAuthn real (challenge backend).
//        - Botón "Usar contraseña" → fallback con el password del usuario.
//        - Al éxito, muestra <PinRevealCard> con countdown 30s.
//   4) NUNCA persiste el PIN en sessionStorage/localStorage (vulnerabilidad
//      anterior eliminada).

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PinInput } from "@/components/shared/pin-input";
import { PinRevealCard, PinRevealPending } from "@/components/pin-reveal-card";
import { apiClient, ApiError } from "@/lib/api-client";
import {
  parseCreationOptions,
  parseRequestOptions,
  credentialToJson,
  isPlatformAuthenticatorAvailable,
} from "@/lib/webauthn";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tarjeta {
  id: number;
  numeroTarjetaUltimos4: string;
  alias?: string | null;
  proveedor?: string;
  tienePinGuardado: boolean;
}

interface MeResponse {
  id: number;
  username: string;
  webauthnEnabled: boolean;
}

type RevealMode = "idle" | "biometria-loading" | "password-prompt" | "password-loading";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PinPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const tarjetaIdStr = params.id;

  // ── Data ──────────────────────────────────────────────────────────────────
  // Usamos /mis-tarjetas (no /tarjetas/{id}) porque solo MiTarjetaDTO incluye
  // tienePinGuardado y numeroTarjetaUltimos4 — el endpoint admin no.
  const { data: misTarjetas, isLoading: loadingTarjeta } = useQuery<Tarjeta[]>({
    queryKey: ["mis-tarjetas"],
    queryFn: () => apiClient.get<Tarjeta[]>("/tarjetas/mis-tarjetas"),
  });
  const tarjeta = misTarjetas?.find((t) => String(t.id) === tarjetaIdStr);

  const { data: me } = useQuery<MeResponse>({
    queryKey: ["me"],
    queryFn: () => apiClient.get<MeResponse>("/auth/campo/me"),
  });

  const hasSavedPin = tarjeta?.tienePinGuardado ?? false;

  // ── State ─────────────────────────────────────────────────────────────────
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [setPinValue, setSetPinValue] = useState("");
  const [revealedPin, setRevealedPin] = useState<string | null>(null);
  const [revealMode, setRevealMode] = useState<RevealMode>("idle");
  const [passwordValue, setPasswordValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setBiometricAvailable);
  }, []);

  // ── Save PIN (modo "set") ─────────────────────────────────────────────────
  const saveMutation = useMutation<void, Error, string>({
    mutationFn: async (pin: string) => {
      await apiClient.post(`/tarjetas/${tarjetaIdStr}/pin`, { pin });
    },
    onSuccess: () => {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(50);
      toast.success("PIN guardado correctamente");
      queryClient.invalidateQueries({ queryKey: ["tarjeta", tarjetaIdStr] });
      queryClient.invalidateQueries({ queryKey: ["mis-tarjetas"] });
      setTimeout(() => router.push("/tarjetas"), 1500);
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo guardar el PIN",
      );
    },
  });

  // ── Reveal con biometría ──────────────────────────────────────────────────
  async function revealWithBiometric() {
    setRevealMode("biometria-loading");
    try {
      const start = await apiClient.post<{
        token: string;
        publicKeyCredentialRequestOptions: string;
      }>("/webauthn/auth/options", {});
      const opts = parseRequestOptions(start.publicKeyCredentialRequestOptions);
      const cred = (await navigator.credentials.get(opts)) as PublicKeyCredential | null;
      if (!cred) throw new Error("No se obtuvo la credencial biométrica");

      const reveal = await apiClient.post<{ pin: string; expiresIn: number }>(
        `/tarjetas/${tarjetaIdStr}/pin/reveal`,
        {
          assertion: {
            token: start.token,
            credentialJson: credentialToJson(cred),
          },
        },
      );
      setRevealedPin(reveal.pin);
      setRevealMode("idle");
    } catch (err) {
      setRevealMode("idle");
      const msg = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Verificación biométrica fallida";
      toast.error(msg);
    }
  }

  // ── Reveal con password ───────────────────────────────────────────────────
  async function revealWithPassword() {
    if (!passwordValue) {
      toast.error("Introduce tu contraseña");
      return;
    }
    setRevealMode("password-loading");
    try {
      const reveal = await apiClient.post<{ pin: string; expiresIn: number }>(
        `/tarjetas/${tarjetaIdStr}/pin/reveal`,
        { password: passwordValue },
      );
      setRevealedPin(reveal.pin);
      setPasswordValue("");
      setRevealMode("idle");
    } catch (err) {
      setRevealMode("password-prompt");
      const msg = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Contraseña incorrecta";
      toast.error(msg);
    }
  }

  // ── Enrolar credencial biométrica (1ª vez) ────────────────────────────────
  async function enrolBiometric() {
    try {
      const start = await apiClient.post<{
        token: string;
        publicKeyCredentialCreationOptions: string;
      }>("/webauthn/register/options", {});
      const opts = parseCreationOptions(start.publicKeyCredentialCreationOptions);
      const cred = (await navigator.credentials.create(opts)) as PublicKeyCredential | null;
      if (!cred) throw new Error("Enrolamiento cancelado");
      await apiClient.post("/webauthn/register/verify", {
        token: start.token,
        credentialJson: credentialToJson(cred),
        deviceName: navigator.userAgent.slice(0, 80),
      });
      toast.success("Biometría registrada. Ya puedes verificar tu PIN con la huella.");
      // Refrescamos /auth/campo/me para que webauthnEnabled pase a true y el
      // boton "Ver con biometria" aparezca sin recargar la pagina.
      queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Enrolamiento fallido";
      toast.error(msg);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loadingTarjeta) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!tarjeta) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Tarjeta no encontrada.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver
      </button>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground">Tarjeta</p>
        <p className="font-mono text-lg">
          •••• {tarjeta.numeroTarjetaUltimos4}
        </p>
        {tarjeta.alias && (
          <p className="text-xs text-muted-foreground">{tarjeta.alias}</p>
        )}
      </div>

      {/* ─── Modo SET: guardar PIN por primera vez ──────────────────────── */}
      {!hasSavedPin && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <KeyRound className="size-5 text-primary" /> Guardar PIN de la tarjeta
          </h2>
          <p className="text-sm text-muted-foreground">
            Introduce el PIN de 4 dígitos de tu tarjeta. Solo lo verás luego con
            verificación biométrica o tu contraseña — no queda guardado en el
            navegador.
          </p>
          <PinInput
            length={4}
            value={setPinValue}
            onChange={(v) => {
              setSetPinValue(v);
              if (v.length === 4 && /^\d{4}$/.test(v)) saveMutation.mutate(v);
            }}
          />
          {saveMutation.isPending && <PinRevealPending label="Guardando PIN…" />}
        </div>
      )}

      {/* ─── Modo REVEAL: el PIN ya está guardado ───────────────────────── */}
      {hasSavedPin && revealedPin && (
        <PinRevealCard
          pin={revealedPin}
          expiresIn={30}
          onExpire={() => setRevealedPin(null)}
        />
      )}

      {hasSavedPin && !revealedPin && revealMode === "idle" && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-5 text-primary" /> Ver PIN de la tarjeta
          </h2>
          <p className="text-sm text-muted-foreground">
            El PIN se mostrará durante 30 segundos. Elige cómo verificar:
          </p>

          {me?.webauthnEnabled && biometricAvailable && (
            <button
              type="button"
              onClick={revealWithBiometric}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground transition hover:opacity-95"
            >
              <Fingerprint className="size-5" />
              Ver con biometría
            </button>
          )}

          {/* Caso 1: el dispositivo no tiene biometria fisica. Solo password. */}
          {!biometricAvailable && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <AlertCircle className="size-4 shrink-0" />
              Tu dispositivo no soporta biometría. Usa tu contraseña.
            </div>
          )}

          {/* Caso 2: el dispositivo tiene biometria pero el usuario AUN no la
              ha activado en este movil. Mostramos un boton PRINCIPAL para
              activarla — antes solo aparecia como link minusculo y solo cuando
              ya estaba activada, por lo que un usuario nuevo nunca lo veia. */}
          {biometricAvailable && !me?.webauthnEnabled && (
            <button
              type="button"
              onClick={enrolBiometric}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 font-semibold text-primary transition hover:bg-primary/20"
            >
              <Fingerprint className="size-5" />
              Activar biometría en este dispositivo
            </button>
          )}

          <button
            type="button"
            onClick={() => setRevealMode("password-prompt")}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 font-medium text-foreground hover:bg-accent"
          >
            <KeyRound className="size-5" />
            Usar contraseña
          </button>

          {/* Re-enrolar / mover biometria a este dispositivo. Solo cuando ya
              tiene credencial. Modelo "una credencial activa por usuario":
              al darle, el backend hace soft-delete de la anterior y guarda
              esta. UX: verbo "Cambiar" para distinguir del primer enrolamiento
              ("Activar"), porque sustituyes una cosa por otra en lugar de
              encender algo desde cero. */}
          {me?.webauthnEnabled && biometricAvailable && (
            <button
              type="button"
              onClick={enrolBiometric}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-primary hover:bg-primary/5 hover:text-primary"
            >
              <Fingerprint className="size-4" />
              Cambiar biometría a este dispositivo
            </button>
          )}
        </div>
      )}

      {hasSavedPin && revealMode === "biometria-loading" && (
        <PinRevealPending label="Esperando huella/face del dispositivo…" />
      )}

      {hasSavedPin && revealMode === "password-prompt" && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <KeyRound className="size-5 text-primary" /> Tu contraseña
          </h2>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              placeholder="Contraseña de tu usuario"
              className="w-full rounded-lg border border-border bg-background pl-3 pr-10 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") revealWithPassword();
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setRevealMode("idle");
                setPasswordValue("");
              }}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={revealWithPassword}
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-95"
            >
              Verificar
            </button>
          </div>
        </div>
      )}

      {hasSavedPin && revealMode === "password-loading" && (
        <PinRevealPending label="Verificando contraseña…" />
      )}
    </div>
  );
}
