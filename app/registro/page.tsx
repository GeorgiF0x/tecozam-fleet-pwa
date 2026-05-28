"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z
  .object({
    nombre: z.string().min(2, "Mínimo 2 caracteres"),
    apellidos: z.string().min(2, "Mínimo 2 caracteres"),
    telefono: z
      .string()
      .regex(/^[6789]\d{8}$/, "Introduce un teléfono móvil válido (España)"),
    dni: z
      .string()
      .optional()
      .refine(
        (v) =>
          !v ||
          // DNI español:    8 dígitos + letra            → 12345678A
          // NIE español:    X|Y|Z + 7 dígitos + letra    → X8971999K
          // Documento ext.: alfanumérico 5-20 chars      → pasaportes / IDs extranjeros
          /^(\d{8}[A-Za-z]|[XYZxyz]\d{7}[A-Za-z]|[A-Za-z0-9-]{5,20})$/.test(v),
        "Formato no válido (DNI, NIE o documento de identidad)",
      ),
    username: z
      .string()
      .min(4, "Mínimo 4 caracteres")
      .regex(/^\S+$/, "Sin espacios"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

// ─── Field component ──────────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

const inputCls = (hasError?: boolean) =>
  cn(
    "h-12 w-full rounded-lg border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground",
    "outline-none transition-colors focus:ring-2 focus:ring-ring/20",
    hasError
      ? "border-destructive focus:border-destructive"
      : "border-border focus:border-ring",
  );

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RegistroPage() {
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError(null);
    try {
      await apiClient.post("/auth/campo/registro", {
        nombre: data.nombre,
        apellidos: data.apellidos,
        telefono: data.telefono,
        dni: data.dni || undefined,
        username: data.username,
        password: data.password,
      });
      setSuccess(true);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Error al registrar. Inténtalo de nuevo.";
      setServerError(message);
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[400px] flex flex-col items-center gap-6 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-success/15 border border-success/30">
            <CheckCircle className="size-10 text-success" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Solicitud enviada</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu cuenta está pendiente de activación. Un responsable revisará tu solicitud y te notificará.
            </p>
          </div>
          <Link
            href="/login"
            className="flex h-12 w-full items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/30 transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-[400px] flex flex-col gap-6">

        {/* Brand */}
        <div className="flex flex-col items-center gap-3">
          <div className="size-16 overflow-hidden rounded-2xl border-2 border-primary/20">
            <Image src="/tecozam-logo.png" alt="Tecozam Fleet" width={64} height={64} className="object-cover size-full" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">
              <span className="text-primary">Tecozam</span>{" "}
              <span className="text-foreground">Fleet</span>
            </h1>
            <p className="text-sm text-muted-foreground">Crear nueva cuenta</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl">
          {serverError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre" error={errors.nombre?.message}>
                <input
                  {...register("nombre")}
                  placeholder="Juan"
                  autoComplete="given-name"
                  className={inputCls(!!errors.nombre)}
                />
              </Field>
              <Field label="Apellidos" error={errors.apellidos?.message}>
                <input
                  {...register("apellidos")}
                  placeholder="García"
                  autoComplete="family-name"
                  className={inputCls(!!errors.apellidos)}
                />
              </Field>
            </div>

            <Field label="Teléfono móvil" error={errors.telefono?.message}>
              <input
                {...register("telefono")}
                type="tel"
                placeholder="612345678"
                autoComplete="tel"
                inputMode="numeric"
                className={inputCls(!!errors.telefono)}
              />
            </Field>

            <Field
              label="DNI / NIE (opcional)"
              error={errors.dni?.message}
            >
              <input
                {...register("dni")}
                placeholder="12345678A · X1234567A"
                autoCapitalize="characters"
                className={inputCls(!!errors.dni)}
              />
            </Field>

            <Field label="Usuario" error={errors.username?.message}>
              <input
                {...register("username")}
                placeholder="nombre.apellido (mín. 4 chars)"
                autoComplete="username"
                autoCapitalize="none"
                className={inputCls(!!errors.username)}
              />
            </Field>

            <Field label="Contraseña" error={errors.password?.message}>
              <input
                {...register("password")}
                type="password"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                className={inputCls(!!errors.password)}
              />
            </Field>

            <Field label="Confirmar contraseña" error={errors.confirmPassword?.message}>
              <input
                {...register("confirmPassword")}
                type="password"
                placeholder="Repite la contraseña"
                autoComplete="new-password"
                className={inputCls(!!errors.confirmPassword)}
              />
            </Field>

            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "mt-2 flex h-12 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/30",
                "transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isSubmitting ? "Enviando..." : "Registrarme"}
            </button>
          </form>
        </div>

        {/* Login link */}
        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
