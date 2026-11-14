// Keeps the app working offline and caches Open Charge Map responses.
//
// - Open Charge Map: cached for a day, off the main thread, so panning back
//   or reloading doesn't hit the API. If the network fails, an expired copy
//   is better than nothing.
// - The app's own pages and files: pages come from the network first, so a
//   new deploy shows up right away, with the cached copy as the offline
//   fallback. Built files have a content hash in their name, so they never
//   change and come from the cache first.
// - Google Maps and Google sign-in are never cached: Google's terms don't
//   allow it, so the map needs a connection.

const CACHE_NAME = "ev-maps-open-charge-map-v1";
const APP_CACHE_NAME = "ev-maps-app-v1";
// The app's files have a single version each, but servers can send
// "Vary: Origin", which would stop module scripts (sent with an Origin
// header) from matching the precached copies.
const APP_MATCH_OPTIONS = { ignoreVary: true };
const HASHED_ASSETS_PATH = "/_astro/";
const API_ORIGIN = "https://api.openchargemap.io";
const CACHED_AT_HEADER = "x-ev-maps-cached-at";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const isFresh = (response) =>
  Date.now() - Number(response.headers.get(CACHED_AT_HEADER)) < MAX_AGE_MS;

// Stores a copy of the response with the time it was cached.
const cacheResponse = async (cache, request, response) => {
  const headers = new Headers(response.headers);
  headers.set(CACHED_AT_HEADER, String(Date.now()));
  const body = await response.clone().arrayBuffer();
  await cache.put(request, new Response(body, { status: response.status, headers }));
};

const fetchWithCache = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached && isFresh(cached)) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cacheResponse(cache, request, response);
    }
    return response;
  } catch (error) {
    if (cached) {
      return cached;
    }
    throw error;
  }
};

const deleteExpiredResponses = async () => {
  const cache = await caches.open(CACHE_NAME);
  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    if (response && !isFresh(response)) {
      await cache.delete(request);
    }
  }
};

// Pages: the network first, so new deploys show up right away.
const networkFirst = async (request) => {
  const cache = await caches.open(APP_CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ...APP_MATCH_OPTIONS, ignoreSearch: true });
    if (cached) {
      return cached;
    }
    throw error;
  }
};

// Hashed build files never change, so the cache can always answer.
const cacheFirst = async (request) => {
  const cache = await caches.open(APP_CACHE_NAME);
  const cached = await cache.match(request, APP_MATCH_OPTIONS);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
};

// The first visit's page and files load before the service worker takes
// control, so cache them on install: the page and the files it references.
const precacheApp = async () => {
  const cache = await caches.open(APP_CACHE_NAME);
  const response = await fetch("/");
  if (!response.ok) {
    return;
  }
  await cache.put("/", response.clone());
  const html = await response.text();
  const files = new Set(html.match(/\/_astro\/[^"'\s)]+/g) ?? []);
  files.add("/favicon.svg");
  await cache.addAll([...files]);
};

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(precacheApp().catch(() => {}));
});

// Take over open pages right away, so the first visit is cached too.
self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([self.clients.claim(), deleteExpiredResponses()]));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin === API_ORIGIN) {
    event.respondWith(fetchWithCache(request));
  } else if (url.origin !== self.location.origin) {
    return;
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith(HASHED_ASSETS_PATH) || url.pathname === "/favicon.svg") {
    // Only built files: the dev server's modules aren't cached.
    event.respondWith(cacheFirst(request));
  }
});
