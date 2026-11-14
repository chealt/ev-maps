// Caches Open Charge Map responses for a day, off the main thread, so
// panning back or reloading doesn't hit the API. If the network fails, an
// expired copy is better than nothing.

const CACHE_NAME = "ev-maps-open-charge-map-v1";
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

self.addEventListener("install", () => self.skipWaiting());

// Take over open pages right away, so the first visit is cached too.
self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([self.clients.claim(), deleteExpiredResponses()]));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method === "GET" && new URL(request.url).origin === API_ORIGIN) {
    event.respondWith(fetchWithCache(request));
  }
});
