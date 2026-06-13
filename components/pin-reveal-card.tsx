"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, ShieldCheck, Loader2 } from "lucide-react";

// ─── Visualizador del PIN con countdown 30s ───────────────────────────────────
// Recibe el PIN ya revelado por el backend. NO lo guarda en disco/memoria
// persistente — se desmonta y el estado se va. Avisa visualmente del tiempo
// restante. Cuando llega a 0, se oculta y avisa al padre.

interface PinRevealCardProps {
  pin: string;
  expiresIn?: number; // segundos
  onExpire?: () => void;
}

export function PinRevealCard({ pin, expiresIn = 30, onExpire }: PinRevealCardProps) {
  const [remaining, setRemaining] = useState(expiresIn);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(50);
    setRemaining(expiresIn);
    setHidden(false);
  }, [pin, expiresIn]);

  useEffect(() => {
    if (remaining <= 0) {
      setHidden(true);
      onExpire?.();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onExpire]);

  const pct = Math.max(0, Math.min(100, (remaining / expiresIn) * 100));

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-6 shadow-lg">
      <div className="mb-4 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
        <ShieldCheck className="size-5" />
        <span>PIN verificado</span>
      </div>

      <div className="mb-4 text-center">
        {hidden ? (
          <div className="flex h-20 items-center justify-center text-muted-foreground">
            <EyeOff className="mr-2 size-5" />
            <span>PIN oculto</span>
          </div>
        ) : (
          <div
            aria-label="PIN de la tarjeta"
            className="select-all font-mono text-5xl font-bold tracking-[0.3em] text-foreground"
          >
            {pin}
          </div>
        )}
      </div>

      {!hidden && (
        <>
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="size-3" /> Visible {remaining}s
            </span>
            <span>Se ocultará automáticamente</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-1000 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Spinner de pendiente (mientras se hace la verificación al backend) ────────

export function PinRevealPending({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border bg-card p-6">
      <Loader2 className="size-5 animate-spin text-primary" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
