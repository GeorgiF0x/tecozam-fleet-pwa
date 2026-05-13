"use client";

import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "tecozam:install-banner-dismissed";

export function InstallPwaBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isStandalone) return;

    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    setDismissed(false);

    const isIOS =
      /iPad|iPhone|iPod/.test(window.navigator.userAgent) &&
      !(window as Window & { MSStream?: unknown }).MSStream;

    if (isIOS) {
      setShowIosHint(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === "accepted") {
      handleDismiss();
    }
  }

  if (dismissed) return null;
  if (!deferredPrompt && !showIosHint) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-50 mx-auto max-w-[480px] px-4">
      <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-card p-4 shadow-lg shadow-black/20">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <Download className="size-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Instalar Tecozam Fleet</p>

          {deferredPrompt && (
            <>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Tenla siempre a mano en tu pantalla de inicio.
              </p>
              <button
                onClick={handleInstall}
                className="mt-2 flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                <Download className="size-3.5" />
                Instalar
              </button>
            </>
          )}

          {showIosHint && (
            <div className="mt-1 space-y-1.5 text-xs text-muted-foreground">
              <p>Para instalar en iPhone:</p>
              <p className="flex items-center gap-1">
                1. Toca <Share className="size-3.5" /> Compartir
              </p>
              <p className="flex items-center gap-1">
                2. Elige <Plus className="size-3.5" /> &quot;Añadir a pantalla de inicio&quot;
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleDismiss}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="Cerrar"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
