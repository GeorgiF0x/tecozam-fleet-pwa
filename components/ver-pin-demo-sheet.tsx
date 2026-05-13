"use client";

import { useEffect, useState } from "react";
import { Fingerprint, X, Eye, Loader2, ShieldCheck } from "lucide-react";
import type { Tarjeta } from "@/app/tarjetas/page";

type State = "init" | "verifying" | "showing" | "expired";

const DEMO_PIN = "1234";
const COUNTDOWN_SECONDS = 10;

export function VerPinDemoSheet({
  tarjeta,
  open,
  onClose,
}: {
  tarjeta: Tarjeta;
  open: boolean;
  onClose: () => void;
}) {
  const [state, setState] = useState<State>("init");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (open) {
      setState("init");
      setCountdown(COUNTDOWN_SECONDS);
    }
  }, [open]);

  useEffect(() => {
    if (state !== "showing") return;
    if (countdown <= 0) {
      setState("expired");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [state, countdown]);

  function handleAuthenticate() {
    setState("verifying");
    setTimeout(() => {
      setState("showing");
      setCountdown(COUNTDOWN_SECONDS);
    }, 800);
  }

  function handleRetry() {
    setState("init");
    setCountdown(COUNTDOWN_SECONDS);
  }

  if (!open) return null;

  const tarjetaName = tarjeta.alias ?? `Tarjeta ${tarjeta.proveedor}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-t-3xl bg-card p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-foreground">Ver PIN</h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {tarjetaName} **** {tarjeta.numeroTarjetaUltimos4}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="size-5 text-foreground" />
          </button>
        </div>

        {/* Mockup notice */}
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
          <ShieldCheck className="size-3.5 shrink-0 text-warning" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-warning">
            Vista previa · disponible en V1.1
          </p>
        </div>

        {/* States */}
        {state === "init" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <button
              onClick={handleAuthenticate}
              className="group flex size-24 items-center justify-center rounded-full bg-primary/15 transition-all hover:bg-primary/25 active:scale-95"
              aria-label="Verificar identidad"
            >
              <Fingerprint className="size-12 text-primary transition-transform group-hover:scale-110" />
            </button>
            <p className="text-center text-sm font-semibold text-foreground">
              Toca para verificar tu identidad
            </p>
            <p className="max-w-[300px] text-center text-xs text-muted-foreground">
              Usaremos la biometría de tu dispositivo (huella o reconocimiento facial) para
              mostrar el PIN de forma segura.
            </p>
          </div>
        )}

        {state === "verifying" && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Verificando identidad…</p>
          </div>
        )}

        {state === "showing" && (
          <div className="flex flex-col items-center gap-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              PIN de la tarjeta
            </p>
            <div className="flex items-center gap-3">
              {DEMO_PIN.split("").map((d, i) => (
                <div
                  key={i}
                  className="flex size-14 items-center justify-center rounded-xl border-2 border-primary/30 bg-primary/5 text-2xl font-bold text-foreground tabular-nums"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="flex w-full max-w-[200px] items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-1000 ease-linear"
                  style={{ width: `${(countdown / COUNTDOWN_SECONDS) * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold tabular-nums text-muted-foreground">
                {countdown}s
              </span>
            </div>

            <p className="max-w-[280px] text-center text-[11px] text-muted-foreground">
              El PIN se ocultará automáticamente. Cada consulta queda registrada para auditoría.
            </p>
          </div>
        )}

        {state === "expired" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex size-16 items-center justify-center rounded-full border border-border bg-muted">
              <Eye className="size-7 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">PIN ocultado</p>
            <button
              onClick={handleRetry}
              className="rounded-lg border border-primary/40 bg-primary/10 px-5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              Verificar de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
