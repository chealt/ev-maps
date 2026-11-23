// Keeps the app working offline and caches charger tiles.
//
// - Charger tiles (/api/chargers/…): cached for a day, off the main thread,
//   so panning back or reloading doesn't hit the API. If the network fails,
//   an expired copy is better than nothing.
// - The app's own pages and files: pages come from the network first, so a
//   new deploy shows up right away, with the cached copy as the offline
//   fallback. Built files have a content hash in their name, so they never
//   change and come from the cache first.
// - Google Maps and Google sign-in are never cached: Google's terms don't
//   allow it, so the map needs a connection.
// - Favorites (/api/favorites…): changes are kept in IndexedDB first and
//   answered right away, then sent to the Worker from an outbox (now, on
//   Background Sync, and before the list is read); the list comes from the
//   network, or from IndexedDB offline, with the unsent changes on top.
// - Live statuses (/api/chargers/status?ids=…): one cache for every tab,
//   fresh for a minute. Only the IDs that aren't fresh are fetched, and IDs
//   another tab is already fetching are waited for, so two tabs make one
//   request per batch. Kept in memory only, and dropped on sign-out.

const CACHE_NAME = "ev-maps-chargers-v1";
// Caches of earlier versions, removed on activation.
const OLD_CACHE_NAMES = ["ev-maps-open-charge-map-v1"];
const APP_CACHE_NAME = "ev-maps-app-v1";
// The app's files have a single version each, but servers can send
// "Vary: Origin", which would stop module scripts (sent with an Origin
// header) from matching the precached copies.
const APP_MATCH_OPTIONS = { ignoreVary: true };
const HASHED_ASSETS_PATH = "/_astro/";
const ADMIN_PAGE_PATH = /^\/[a-z]{2}\/admin(\/|$)/;
// Only the tiles (/api/chargers/{z}/{x}/{y}): live statuses must stay live.
const TILE_PATH = /^\/api\/chargers\/\d+\/\d+\/\d+$/;
const CACHED_AT_HEADER = "x-ev-maps-cached-at";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const FAVORITES_PATH = "/api/favorites";
const FAVORITE_PATH = /^\/api\/favorites\/([^/]+)$/;
const FAVORITES_SYNC_TAG = "favorites-sync";
const STATE_DB = "ev-maps-sw";
const STATE_STORE = "state";
// The last list from the Worker, and the changes not sent yet.
const FAVORITES_KEY = "favorites";
const OUTBOX_KEY = "favorites-outbox";

const STATUS_PATH = "/api/chargers/status";
const STATUS_MAX_AGE_MS = 60 * 1000;
// The Worker's batch size for statuses (MAX_IDS in packages/worker's
// src/live-status.js).
const STATUS_BATCH_SIZE = 100;
// ID → { status, fetchedAt }, and ID → the promise of the fetch it's in.
const statuses = new Map();
const statusFetches = new Map();

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// Fetches a batch of IDs from the Worker into `statuses`. Resolves to the
// Worker's status code; a 401 (signed out) leaves the cache as it was.
const fetchStatusBatch = async (batch, request) => {
  const url = new URL(STATUS_PATH, self.location.origin);
  url.searchParams.set("ids", batch.join(","));
  const response = await fetch(url, { credentials: request.credentials, headers: request.headers });
  if (response.ok) {
    const body = await response.json();
    const fetchedAt = Date.now();
    for (const id of batch) {
      statuses.set(id, { status: body.statuses?.[id] ?? null, fetchedAt });
    }
  }
  return response.status;
};

// Answers a page's status request from the shared cache, fetching only the
// IDs that are neither fresh nor already being fetched.
const liveStatuses = async (request) => {
  const ids = [
    ...new Set(new URL(request.url).searchParams.get("ids")?.split(",").filter(Boolean)),
  ];
  const now = Date.now();
  const missing = ids.filter(
    (id) => !statusFetches.has(id) && now - (statuses.get(id)?.fetchedAt ?? 0) >= STATUS_MAX_AGE_MS
  );
  for (let start = 0; start < missing.length; start += STATUS_BATCH_SIZE) {
    const batch = missing.slice(start, start + STATUS_BATCH_SIZE);
    const fetching = fetchStatusBatch(batch, request).finally(() => {
      for (const id of batch) {
        statusFetches.delete(id);
      }
    });
    for (const id of batch) {
      statusFetches.set(id, fetching);
    }
  }
  let codes;
  try {
    codes = await Promise.all(new Set(ids.map((id) => statusFetches.get(id)).filter(Boolean)));
  } catch {
    return json({ error: "Could not load the statuses" }, 502);
  }
  if (codes.includes(401)) {
    return json({ error: "Sign in to see live availability" }, 401);
  }
  const found = {};
  for (const id of ids) {
    const status = statuses.get(id)?.status;
    if (status) {
      found[id] = status;
    }
  }
  return json({ statuses: found });
};

// Reports the pages post here (src/lib/report-channel.js): usage counts,
// performance spans and Web Vitals, and errors. They're merged into one
// outbox in IndexedDB, sent a few seconds after the first of a batch for
// every tab at once, and kept for Background Sync when they can't be sent,
// so closing or freezing a tab loses none.
const REPORTS_KEY = "reports-outbox";
const REPORTS_SYNC_TAG = "reports-sync";
const REPORT_DELAY_MS = 10 * 1000;
const USAGE_URL = "/api/usage";
const TELEMETRY_URL = "/api/telemetry";
const ERRORS_URL = "/api/errors";

const emptyReports = () => ({ usage: {}, spans: [], vitals: [], errors: [] });

// Adds a report to the outbox: usage counts add up, the rest are listed.
const mergeReport = (outbox, { kind, payload }) => {
  if (kind === "usage") {
    for (const [event, dimensions] of Object.entries(payload)) {
      outbox.usage[event] ??= {};
      for (const [dimension, count] of Object.entries(dimensions)) {
        outbox.usage[event][dimension] = (outbox.usage[event][dimension] ?? 0) + count;
      }
    }
  } else if (kind === "span" || kind === "vital" || kind === "error") {
    outbox[`${kind}s`].push(payload);
  }
  return outbox;
};

const postJson = (url, data) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });

// True when the Worker took it or never will (e.g. a 400): not worth
// sending again.
const delivered = (request) =>
  request.then(
    (response) => response.ok || isFinal(response.status),
    () => false
  );

// Sends the outbox; what couldn't be sent goes back into it, with anything
// added meanwhile. False while something is left.
const sendReports = async () => {
  const outbox = await serially(async () => {
    const queued = (await readState(REPORTS_KEY)) ?? emptyReports();
    await deleteState(REPORTS_KEY);
    return queued;
  });
  const left = emptyReports();
  const sends = [];
  if (Object.keys(outbox.usage).length) {
    sends.push(
      delivered(postJson(USAGE_URL, { events: outbox.usage })).then((ok) => {
        if (!ok) {
          left.usage = outbox.usage;
        }
      })
    );
  }
  if (outbox.spans.length || outbox.vitals.length) {
    sends.push(
      delivered(postJson(TELEMETRY_URL, { spans: outbox.spans, vitals: outbox.vitals })).then(
        (ok) => {
          if (!ok) {
            left.spans = outbox.spans;
            left.vitals = outbox.vitals;
          }
        }
      )
    );
  }
  for (const details of outbox.errors) {
    sends.push(
      delivered(postJson(ERRORS_URL, details)).then((ok) => {
        if (!ok) {
          left.errors.push(details);
        }
      })
    );
  }
  await Promise.all(sends);
  const unsent =
    Object.keys(left.usage).length || left.spans.length || left.vitals.length || left.errors.length;
  if (unsent) {
    await serially(async () => {
      const added = (await readState(REPORTS_KEY)) ?? emptyReports();
      for (const [event, dimensions] of Object.entries(left.usage)) {
        mergeReport(added, { kind: "usage", payload: { [event]: dimensions } });
      }
      added.spans.unshift(...left.spans);
      added.vitals.unshift(...left.vitals);
      added.errors.unshift(...left.errors);
      await writeState(REPORTS_KEY, added);
    });
    await self.registration.sync?.register(REPORTS_SYNC_TAG).catch(() => {});
  }
  return !unsent;
};

// One send a few seconds after the first report of a batch; the message
// event waits for it, which keeps the worker alive until it's done.
let reportsSend = null;
const scheduleReports = () => {
  reportsSend ??= new Promise((resolve) => setTimeout(resolve, REPORT_DELAY_MS))
    .then(sendReports)
    .catch(() => false)
    .finally(() => {
      reportsSend = null;
    });
  return reportsSend;
};

const queueReport = async (report) => {
  await serially(async () => {
    const outbox = (await readState(REPORTS_KEY)) ?? emptyReports();
    await writeState(REPORTS_KEY, mergeReport(outbox, report));
  });
  await scheduleReports();
};

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

// Any cached page, e.g. for / offline: online, the Worker redirects it to the
// visitor's language and country, which can't be cached.
const anyCachedPage = async (cache) => {
  const pages = (await cache.keys()).filter((request) =>
    new URL(request.url).pathname.endsWith("/")
  );
  return pages.length ? cache.match(pages.at(-1), APP_MATCH_OPTIONS) : undefined;
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
    const cached =
      (await cache.match(request, { ...APP_MATCH_OPTIONS, ignoreSearch: true })) ??
      (new URL(request.url).pathname === "/" ? await anyCachedPage(cache) : undefined);
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
// control, so cache them on install: the open pages, and the files the build
// lists in precache-manifest.json (see astro.config.mjs; the dev server has
// none).
const precacheApp = async () => {
  const cache = await caches.open(APP_CACHE_NAME);
  const pages = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  await Promise.all(pages.map(({ url }) => cache.add(new URL(url).pathname).catch(() => {})));
  const response = await fetch("/precache-manifest.json");
  if (response.ok) {
    await cache.addAll(await response.json());
  }
};

// IndexedDB, one value per key, each read or write its own transaction.
const openStateDb = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(STATE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STATE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const inStore = async (mode, use) => {
  const db = await openStateDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STATE_STORE, mode);
    const request = use(transaction.objectStore(STATE_STORE));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
  });
};

const readState = (key) => inStore("readonly", (store) => store.get(key));
const writeState = (key, value) => inStore("readwrite", (store) => store.put(value, key));
const deleteState = (key) => inStore("readwrite", (store) => store.delete(key));

// Changes to the stored favorites run one after the other, so concurrent
// requests don't overwrite each other's.
let stateQueue = Promise.resolve();
const serially = (change) => {
  const run = stateQueue.then(change);
  stateQueue = run.catch(() => {});
  return run;
};

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const favoriteUrl = (id) => `${FAVORITES_PATH}/${encodeURIComponent(id)}`;

// The favorites with the changes applied, newest first.
const applyChanges = (favorites, changes) => {
  const byId = new Map(favorites.map((favorite) => [favorite.charger.id, favorite]));
  for (const { id, method, body } of changes) {
    if (method === "PUT") {
      byId.set(id, body);
    } else {
      byId.delete(id);
    }
  }
  return [...byId.values()].sort((a, b) => b.addedAt - a.addedAt);
};

const forgetFavorites = () =>
  serially(() => Promise.all([deleteState(FAVORITES_KEY), deleteState(OUTBOX_KEY)]));

// The Worker refused it for good (e.g. invalid), so it isn't sent again;
// signed out, rate limited or failing, it's kept for later.
const isFinal = (status) => status < 500 && ![401, 408, 429].includes(status);

// Sends the outbox's changes in order; true once it's empty. A change made
// again meanwhile (same charger, later) stays for the next round.
const sendChanges = async () => {
  for (const change of (await readState(OUTBOX_KEY)) ?? []) {
    let response;
    try {
      response = await fetch(favoriteUrl(change.id), {
        method: change.method,
        headers: change.body ? { "content-type": "application/json" } : {},
        body: change.body ? JSON.stringify(change.body) : undefined,
      });
    } catch {
      return false;
    }
    if (!response.ok && !isFinal(response.status)) {
      return false;
    }
    await serially(async () => {
      const outbox = (await readState(OUTBOX_KEY)) ?? [];
      await writeState(
        OUTBOX_KEY,
        outbox.filter((queued) => queued.id !== change.id || queued.at !== change.at)
      );
      if (response.ok) {
        await writeState(
          FAVORITES_KEY,
          applyChanges((await readState(FAVORITES_KEY)) ?? [], [change])
        );
      }
    });
  }
  return ((await readState(OUTBOX_KEY)) ?? []).length === 0;
};

let sending = null;
const flushFavorites = () => {
  sending ??= sendChanges()
    .catch(() => false)
    .finally(() => {
      sending = null;
    });
  return sending;
};

// The list: from the Worker once the outbox is sent, else (offline, or the
// Worker failing) the stored one; either way with the unsent changes.
const favoritesList = async (request) => {
  await flushFavorites();
  let response;
  try {
    response = await fetch(request);
  } catch {
    response = null;
  }
  if (response?.status === 401) {
    await forgetFavorites();
    return response;
  }
  if (response?.ok) {
    const { favorites } = await response.json();
    return jsonResponse({
      favorites: await serially(async () => {
        await writeState(FAVORITES_KEY, favorites);
        return applyChanges(favorites, (await readState(OUTBOX_KEY)) ?? []);
      }),
    });
  }
  const stored = await readState(FAVORITES_KEY);
  const outbox = (await readState(OUTBOX_KEY)) ?? [];
  if (stored === undefined && outbox.length === 0) {
    return response ?? jsonResponse({ error: "Offline" }, 503);
  }
  return jsonResponse({ favorites: applyChanges(stored ?? [], outbox) });
};

// Saving or removing one: kept in the outbox (replacing an earlier change of
// the same charger) and answered right away, then sent.
const changeFavorite = async (event, id) => {
  const { request } = event;
  let body = null;
  if (request.method === "PUT") {
    body = await request
      .clone()
      .json()
      .catch(() => null);
    if (body?.charger?.id !== id) {
      return fetch(request);
    }
  }
  await serially(async () => {
    const outbox = ((await readState(OUTBOX_KEY)) ?? []).filter((queued) => queued.id !== id);
    outbox.push({ id, method: request.method, body, at: Date.now() });
    await writeState(OUTBOX_KEY, outbox);
  });
  event.waitUntil(
    flushFavorites().then((sent) =>
      sent ? undefined : self.registration.sync?.register(FAVORITES_SYNC_TAG).catch(() => {})
    )
  );
  return jsonResponse({ queued: id }, 202);
};

// Throws while changes are left, so the browser tries again later.
self.addEventListener("sync", (event) => {
  if (event.tag === REPORTS_SYNC_TAG) {
    event.waitUntil(
      sendReports().then((sent) => {
        if (!sent) {
          throw new Error("Reports not sent yet");
        }
      })
    );
  }
  if (event.tag === FAVORITES_SYNC_TAG) {
    event.waitUntil(
      flushFavorites().then((sent) => {
        if (!sent) {
          throw new Error("Favorites not sent yet");
        }
      })
    );
  }
});

// The page says when the user signed out: their favorites go.
self.addEventListener("message", (event) => {
  if (event.data?.type === "report") {
    event.waitUntil(queueReport(event.data).catch(() => {}));
    return;
  }
  if (event.data?.type === "forget-favorites") {
    // Live statuses are for signed-in users only.
    statuses.clear();
    event.waitUntil(forgetFavorites());
  }
});

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(precacheApp().catch(() => {}));
});

// Take over open pages right away, so the first visit is cached too.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      deleteExpiredResponses(),
      ...OLD_CACHE_NAMES.map((name) => caches.delete(name)),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  const favoriteId = url.pathname.match(FAVORITE_PATH)?.[1];
  if (favoriteId && (request.method === "PUT" || request.method === "DELETE")) {
    event.respondWith(changeFavorite(event, decodeURIComponent(favoriteId)));
    return;
  }
  if (request.method !== "GET") {
    return;
  }
  if (url.pathname === FAVORITES_PATH) {
    event.respondWith(favoritesList(request));
    return;
  }
  if (url.pathname === STATUS_PATH) {
    event.respondWith(liveStatuses(request));
    return;
  }
  if (TILE_PATH.test(url.pathname)) {
    event.respondWith(fetchWithCache(request));
  } else if (request.mode === "navigate" && ADMIN_PAGE_PATH.test(url.pathname)) {
    // The admin pages are only for admins, decided per request by the Worker:
    // never cached, so they don't outlive signing out.
    return;
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith(HASHED_ASSETS_PATH) || url.pathname === "/favicon.svg") {
    // Only built files: the dev server's modules aren't cached.
    event.respondWith(cacheFirst(request));
  }
});
