/**
 * Shell-only service worker — caches app chrome and static assets, not API data or PDFs.
 * Bump SHELL_VERSION when shell precache list changes.
 */
const SHELL_VERSION = "v1";
const SHELL_CACHE = `circadia-shell-${SHELL_VERSION}`;
const STATIC_CACHE = `circadia-static-${SHELL_VERSION}`;
const PAGES_CACHE = `circadia-pages-${SHELL_VERSION}`;

const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/icon-512-maskable.svg",
];

/** Driver field routes worth keeping for offline reopen (not manager/admin). */
function isDriverShellPath(pathname) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/driver") ||
    pathname.startsWith("/sheets")
  );
}

function isNetworkOnlyPath(pathname) {
  if (pathname.startsWith("/api/")) return true;
  if (pathname.includes("roadside-produce")) return true;
  if (pathname.endsWith("/export")) return true;
  return false;
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
            .filter((key) => key !== SHELL_CACHE && key !== STATIC_CACHE && key !== PAGES_CACHE)
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
    return;
  }

  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  if (cached) return cached;
  const fresh = await network;
  if (fresh) return fresh;
  return Response.error();
}

async function networkFirstDocument(request) {
  const url = new URL(request.url);
  const pages = await caches.open(PAGES_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok && isDriverShellPath(url.pathname)) {
      pages.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await pages.match(request);
    if (cached) return cached;
    const offline = await caches.match("/offline.html");
    if (offline) return offline;
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}
