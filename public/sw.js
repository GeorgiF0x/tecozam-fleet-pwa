// ─── Tecozam Operarios — Service Worker ──────────────────────────────────────
// Cache-first for shell assets, network-first for API.

const CACHE_VERSION = "tecozam-fleet-v1";
const API_ORIGIN = "https://bills-api.z-innova.com";

const SHELL = [
  "/",
  "/login",
  "/escanear",
  "/tarjetas",
  "/prestamos",
  "/perfil",
  "/historial",
  "/alertas",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
];

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_VERSION)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and API requests (always network for API)
  if (request.method !== "GET") return;
  if (url.origin === API_ORIGIN) return;
  // Solo cachear http(s); chrome-extension:// y otros esquemas no son soportados
  // por la Cache API y revientan el SW si intentamos hacer cache.put.
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Network-first for navigation
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match("/") || caches.match(request))
        .then((res) => res || new Response("Offline", { status: 503 })),
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((networkRes) => {
          if (networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return networkRes;
        }),
    ),
  );
});
