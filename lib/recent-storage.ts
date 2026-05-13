// ─── Recent Storage ────────────────────────────────────────────────────────────
// Lightweight localStorage helper to remember last-used IDs per category key.

const STORAGE_PREFIX = "tecozam-fleet:recent:";
const MAX_RECENTS = 5;

export function getRecents(key: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return [];
    return JSON.parse(raw) as number[];
  } catch {
    return [];
  }
}

export function addRecent(key: string, id: number): void {
  if (typeof window === "undefined") return;
  try {
    const current = getRecents(key);
    const filtered = current.filter((x) => x !== id);
    filtered.unshift(id);
    const trimmed = filtered.slice(0, MAX_RECENTS);
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(trimmed));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export function getLastUsed<T extends { id: number }>(
  key: string,
  items: T[],
): T | null {
  const recents = getRecents(key);
  if (recents.length === 0) return null;
  return items.find((i) => i.id === recents[0]) ?? null;
}

export function getRecentItems<T extends { id: number }>(
  key: string,
  items: T[],
  limit = 3,
): T[] {
  const recents = getRecents(key);
  return recents
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is T => i !== undefined)
    .slice(0, limit);
}
