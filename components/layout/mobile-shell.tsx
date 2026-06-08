"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CreditCard,
  Camera,
  ArrowLeftRight,
  User,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlertasCount {
  total?: number;
  count?: number;
  length?: number;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isFab?: boolean;
}

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/tarjetas", label: "Tarjetas", icon: CreditCard },
  { href: "/escanear", label: "Escanear", icon: Camera, isFab: true },
  { href: "/prestamos", label: "Préstamos", icon: ArrowLeftRight },
  { href: "/perfil", label: "Perfil", icon: User },
];

// ─── Page title mapping ────────────────────────────────────────────────────────

function usePageTitle(pathname: string): string {
  if (pathname === "/") return "Inicio";
  if (pathname.startsWith("/tarjetas")) return "Mis Tarjetas";
  if (pathname.startsWith("/escanear")) return "Escanear Ticket";
  if (pathname.startsWith("/prestamos")) return "Préstamos";
  if (pathname.startsWith("/perfil")) return "Mi Perfil";
  if (pathname.startsWith("/historial")) return "Historial";
  if (pathname.startsWith("/alertas")) return "Alertas";
  return "Tecozam Operarios";
}

// ─── Alert badge query ────────────────────────────────────────────────────────

function useAlertCount(): number {
  const { data } = useQuery<AlertasCount[] | AlertasCount>({
    queryKey: ["alertas-count"],
    queryFn: () => apiClient.get("/alertas/mis-pendientes"),
    staleTime: 30_000,
  });

  if (!data) return 0;
  if (Array.isArray(data)) return data.length;
  return (data as AlertasCount).total ?? (data as AlertasCount).count ?? 0;
}

// ─── Shell ────────────────────────────────────────────────────────────────────

interface MobileShellProps {
  children: React.ReactNode;
}

export function MobileShell({ children }: MobileShellProps) {
  const pathname = usePathname();
  const pageTitle = usePageTitle(pathname);
  const alertCount = useAlertCount();

  return (
    <div className="flex min-h-full flex-col bg-background">
      {/* Centering wrapper for desktop */}
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col relative">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-sm">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="size-7 overflow-hidden rounded-lg">
              <Image
                src="/tecozam-logo.png"
                alt="Tecozam"
                width={28}
                height={28}
                className="object-cover"
              />
            </div>
            <span className="text-sm font-semibold text-foreground truncate max-w-[160px]">
              {pageTitle}
            </span>
          </div>

          {/* Bell icon with badge */}
          <Link
            href="/alertas"
            className="relative flex size-10 items-center justify-center rounded-full transition-colors hover:bg-muted"
            aria-label={`Alertas${alertCount > 0 ? ` (${alertCount} pendientes)` : ""}`}
          >
            <Bell className="size-5 text-foreground" />
            {alertCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                {alertCount > 99 ? "99" : alertCount}
              </span>
            )}
          </Link>
        </header>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto pb-20">
          {children}
        </main>

        {/* ── Bottom navigation ─────────────────────────────────────────── */}
        <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="flex h-16 items-end">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

              if (item.isFab) {
                return (
                  <div key={item.href} className="flex flex-1 items-center justify-center pb-2">
                    <Link
                      href={item.href}
                      className={cn(
                        "relative -top-4 flex size-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/40 transition-transform active:scale-95",
                        isActive && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                      )}
                      aria-label="Escanear ticket"
                    >
                      <Camera className="size-6 text-primary-foreground" />
                    </Link>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative flex flex-1 flex-col items-center justify-end gap-0.5 pb-2 pt-1"
                >
                  {/* Active indicator */}
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-b-full bg-primary" />
                  )}
                  <item.icon
                    className={cn(
                      "size-5 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10px] font-medium transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

      </div>
    </div>
  );
}
