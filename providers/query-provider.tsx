"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Datos creados en Tecozam Bills (centros, asignaciones) deben
            // reflejarse en cuanto el operario vuelva a la app o recupere
            // conexion. FLEET-04: forzamos refetch on focus + reconnect y
            // bajamos el staleTime para que las queries marquen stale rapido.
            staleTime: 15_000,
            retry: 1,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
          },
        },
      }),
  );

  // FLEET-04: en PWAs sobre Android el evento 'focus' no siempre dispara cuando
  // la app vuelve del background. Escuchamos tambien 'visibilitychange' para
  // invalidar queries en cuanto el documento vuelve a ser visible.
  useEffect(() => {
    if (typeof document === "undefined") return;
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        client.invalidateQueries();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
