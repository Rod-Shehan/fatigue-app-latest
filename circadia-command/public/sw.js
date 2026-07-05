/**
 * Shell-only service worker — caches static assets, not API or SSE.
 * Bump SHELL_VERSION when precache list changes.
 */
const SHELL_VERSION = "command-v2";
const SHELL_CACHE = `circadia-command-shell-${SHELL_VERSION}`;
const STATIC_CACHE = `circadia-command-static-${SHELL_VERSION}`;

const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/command-icon-192.svg",
  "/icons/command-icon-512.svg",
  "/icons/command-icon-512-maskable.svg",
];

function isNetworkOnlyPath(pathname) {
  return pathname.startsWith("/api/");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isNetworkOnlyPath(url.pathname)) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  const isDocument =
    request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html");

  if (isDocument) {
    event.respondWith(networkFirstDocument(request));
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirstDocument(request) {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match("/offline.html");
    if (offline) return offline;
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}
