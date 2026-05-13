"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Flame, Droplets, Leaf, Lock, LockOpen, AlertCircle, Loader2 } from "lucide-react";
import { MobileShell } from "@/components/layout/mobile-shell";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Tarjeta {
  id: number;
  numeroTarjetaUltimos4: string;
  alias: string | null;
  proveedor: string;
  producto: string;
  centroCosteNombre: string | null;
  tienePinGuardado: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function proveedorIcon(proveedor: string): React.ComponentType<React.SVGProps<SVGSVGElement>> {
  const p = proveedor.toLowerCase();
  if (p.includes("repsol")) return Flame;
  if (p.includes("moeve") || p.includes("cepsa")) return Droplets;
  if (p.includes("bp")) return Leaf;
  return CreditCard;
}

function proveedorColor(proveedor: string): string {
  const p = proveedor.toLowerCase();
  if (p.includes("repsol")) return "oklch(64% 0.21 30)";  // red-orange
  if (p.includes("moeve") || p.includes("cepsa")) return "oklch(56% 0.16 220)"; // blue
  if (p.includes("bp")) return "oklch(56% 0.18 145)";  // green
  return "var(--primary)";
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function TarjetaCard({ tarjeta }: { tarjeta: Tarjeta }) {
  const Icon = proveedorIcon(tarjeta.proveedor);
  const color = proveedorColor(tarjeta.proveedor);
  const name = tarjeta.alias ?? `Tarjeta ${tarjeta.proveedor}`;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {/* Provider icon */}
        <div
          className="flex size-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)` }}
        >
          <Icon className="size-5" style={{ color } as React.CSSProperties} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{name}</p>
          <p className="text-xs font-medium text-muted-foreground tracking-widest">
            **** {tarjeta.numeroTarjetaUltimos4}
          </p>
        </div>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5">
        {tarjeta.producto && (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {tarjeta.producto}
          </span>
        )}
        {tarjeta.centroCosteNombre && (
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {tarjeta.centroCosteNombre}
          </span>
        )}
      </div>

      {/* PIN button */}
      <Link
        href={`/tarjetas/${tarjeta.id}/pin`}
        className={cn(
          "flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors active:scale-[0.98]",
          tarjeta.tienePinGuardado
            ? "border-success/40 bg-success/10 text-success hover:bg-success/20"
            : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
        )}
      >
        {tarjeta.tienePinGuardado ? (
          <>
            <Lock className="size-3.5" />
            Cambiar PIN
          </>
        ) : (
          <>
            <LockOpen className="size-3.5" />
            Guardar PIN
          </>
        )}
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TarjetasPage() {
  const { data, isLoading, isError, refetch } = useQuery<Tarjeta[]>({
    queryKey: ["mis-tarjetas"],
    queryFn: () => apiClient.get<Tarjeta[]>("/tarjetas/mis-tarjetas"),
  });

  const tarjetas = data ?? [];

  return (
    <MobileShell>
      <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tarjetas asignadas
        </h2>

        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Cargando tarjetas...</p>
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-destructive font-medium">Error al cargar las tarjetas</p>
            <button
              onClick={() => refetch()}
              className="h-9 rounded-lg border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary"
            >
              Reintentar
            </button>
          </div>
        )}

        {!isLoading && !isError && tarjetas.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-16 items-center justify-center rounded-full border border-border bg-card">
              <CreditCard className="size-7 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">Sin tarjetas asignadas</p>
            <p className="max-w-[260px] text-sm text-muted-foreground">
              No tienes tarjetas de combustible asignadas. Contacta con tu responsable.
            </p>
          </div>
        )}

        {!isLoading && !isError && tarjetas.length > 0 && (
          <div className="flex flex-col gap-3">
            {tarjetas.map((t) => (
              <TarjetaCard key={t.id} tarjeta={t} />
            ))}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
