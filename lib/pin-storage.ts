// ─── PIN Local Storage ────────────────────────────────────────────────────────
// sessionStorage helpers to persist the card PIN for the current browser session.
// Keys are scoped per tarjetaId so multiple cards can coexist.

const PREFIX = "tecozam:pin:";

export function savePinLocal(tarjetaId: number, pin: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PREFIX + tarjetaId, pin);
  } catch {
    // sessionStorage unavailable
  }
}

export function getPinLocal(tarjetaId: number): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(PREFIX + tarjetaId);
  } catch {
    return null;
  }
}

export function removePinLocal(tarjetaId: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PREFIX + tarjetaId);
  } catch {
    // noop
  }
}

export function hasPinLocal(tarjetaId: number): boolean {
  return getPinLocal(tarjetaId) !== null;
}
