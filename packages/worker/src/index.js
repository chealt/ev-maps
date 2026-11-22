// The ev-maps Worker. Static assets, including the country pages, are served
// directly; the Worker only runs for:
// - /api/chargers/{z}/{x}/{y}: chargers in a map tile, from D1
// - POST /api/chargers/route: chargers along a route (see route-chargers.js)
// - /api/chargers/status: live availability (see live-status.js)
// - /: redirects to the page for the visitor's language and country
// - /api/auth/*: sign-in and sessions (see auth.js)
// It also runs the charger import on a schedule (see import/index.js), and
// refreshes the live statuses every few minutes.

import { TILE_FORMAT_VERSION, tileBounds } from "@ev-maps/tiles";
import {
  ADMIN_API_PREFIX,
  adminApiResponse,
  adminPageResponse,
  isAdmin,
  isAdminPage,
} from "./admin.js";
import { handleAuth, isAuthPath, userOf } from "./auth.js";
import { chargersInBounds, toClientCharger } from "./db.js";
import { mergeDuplicates } from "./duplicates.js";
import { guard } from "./guard.js";
import { SETTINGS_PATH, settingsResponse } from "./settings.js";
import { favoritesResponse, isFavoritesPath } from "./favorites.js";
import { runImport } from "./import/index.js";
import { STATUS_PATH, refreshStatuses, statusResponse } from "./live-status.js";
import { routeChargersResponse } from "./route-chargers.js";

const MAX_CHARGERS_PER_TILE = 2000;
const MAX_TILE_ZOOM = 18;
// The data changes weekly: browsers keep tiles for an hour, the edge a day.
const TILE_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400";
// wrangler.toml's crons: the import every 15 minutes, statuses every 5.
const STATUS_CRON = "*/5 * * * *";
const DEFAULT_LANGUAGE = "en";
// Set by the app's language picker; it wins over the browser's languages.
const LANGUAGE_COOKIE = "ev-maps-language";
// Each candidate language costs a lookup in the static assets.
const MAX_LANGUAGES_TRIED = 4;

const json = (data, { status = 200, headers = {} } = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

// Tiles are cached by their path and the current format, whatever the query
// string: a new format starts a new cache, and random queries can't fill it.
const tileCacheKey = (request) => {
  const url = new URL(request.url);
  return new Request(new URL(`${url.pathname}?v=${TILE_FORMAT_VERSION}`, url.origin));
};

const tileResponse = async (request, env, { zoom, x, y }, context) => {
  const cacheKey = tileCacheKey(request);
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    return cached;
  }
  const { rows, full } = await chargersInBounds(
    env.DB,
    tileBounds({ zoom, x, y }),
    MAX_CHARGERS_PER_TILE
  );
  const response = json(
    { chargers: mergeDuplicates(rows.map(toClientCharger)), full },
    { headers: { "cache-control": TILE_CACHE_CONTROL } }
  );
  context.waitUntil(caches.default.put(cacheKey, response.clone()));
  return response;
};

const parseTile = (pathname) => {
  const match = /^\/api\/chargers\/(\d+)\/(\d+)\/(\d+)$/.exec(pathname);
  if (!match) {
    return null;
  }
  const [zoom, x, y] = match.slice(1).map(Number);
  const tiles = 2 ** zoom;
  return zoom <= MAX_TILE_ZOOM && x < tiles && y < tiles ? { zoom, x, y } : null;
};

// The languages of an Accept-Language header, most preferred first:
// "hu-HU,hu;q=0.9,en;q=0.8" -> ["hu", "en"].
const preferredLanguages = (header) =>
  (header ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const quality = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
      return {
        language: tag.trim().toLowerCase().split("-")[0],
        quality: quality ? Number(quality.slice(2)) : 1,
      };
    })
    .filter(({ language, quality }) => /^[a-z]{2,3}$/.test(language) && quality > 0)
    .sort((a, b) => b.quality - a.quality)
    .map(({ language }) => language);

const cookieValue = (header, name) =>
  (header ?? "")
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)?.[1];

const pageExists = async (request, env, pathname) => {
  const response = await env.ASSETS.fetch(
    new Request(new URL(pathname, request.url), { method: "HEAD" })
  );
  return response.ok;
};

// The built pages decide what's supported: /{language}/ for every language,
// /{language}/{country}/ for every country with chargers. The language is the
// one the visitor picked, else the browser's, else English.
const localizedPath = async (request, env) => {
  const picked = cookieValue(request.headers.get("cookie"), LANGUAGE_COOKIE)?.toLowerCase();
  const languages = [
    ...new Set([
      ...(/^[a-z]{2,3}$/.test(picked ?? "") ? [picked] : []),
      ...preferredLanguages(request.headers.get("accept-language")),
      DEFAULT_LANGUAGE,
    ]),
  ].slice(0, MAX_LANGUAGES_TRIED);
  let language = DEFAULT_LANGUAGE;
  for (const candidate of languages) {
    if (await pageExists(request, env, `/${candidate}/`)) {
      language = candidate;
      break;
    }
  }
  const country = request.cf?.country?.toLowerCase();
  if (/^[a-z]{2}$/.test(country ?? "")) {
    const countryPath = `/${language}/${country}/`;
    if (await pageExists(request, env, countryPath)) {
      return countryPath;
    }
  }
  return `/${language}/`;
};

// Varies per visitor, so it isn't cached; the pages it points to are.
const redirectToLocalizedPage = async (request, env) => {
  const url = new URL(request.url);
  const location = new URL(await localizedPath(request, env), url);
  location.search = url.search;
  return new Response(null, {
    status: 302,
    headers: {
      location: location.toString(),
      "cache-control": "private, no-store",
      vary: "Accept-Language, Cookie",
    },
  });
};

// The API's answers aren't for search engines or AI (see the terms and
// robots.txt). Cached responses have immutable headers, hence the copy.
const withoutIndexing = (response) => {
  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", "noindex, nofollow, noai, noimageai");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

// The API parts by path, with their access policy (see guard.js).
const apiPolicy = (request, url) => {
  // Sending a sign-in email: much stricter than the rest of sign-in.
  if (request.method === "POST" && url.pathname === "/api/auth/sign-in/magic-link") {
    return "email";
  }
  if (isAuthPath(url.pathname)) {
    return "auth";
  }
  if (request.method === "POST" && url.pathname === "/api/chargers/route") {
    return "route";
  }
  if (request.method === "GET" && url.pathname === STATUS_PATH) {
    return "status";
  }
  if ((request.method === "GET" || request.method === "PUT") && url.pathname === SETTINGS_PATH) {
    return "settings";
  }
  if (isFavoritesPath(url.pathname)) {
    return "favorites";
  }
  if (url.pathname.startsWith(ADMIN_API_PREFIX)) {
    return "admin";
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/chargers/")) {
    return "tiles";
  }
  return null;
};

const route = async (request, env, context) => {
  const url = new URL(request.url);
  const policy = apiPolicy(request, url);
  let userId = null;
  let user = null;
  if (policy) {
    const guarded = await guard(
      request,
      env,
      policy,
      () => userOf(request, env),
      (signedIn) => isAdmin(env, signedIn)
    );
    if (guarded.refused) {
      return guarded.refused;
    }
    ({ userId, user } = guarded);
  }
  if (policy === "admin") {
    return adminApiResponse(request, user);
  }
  if (isAdminPage(url.pathname)) {
    return adminPageResponse(request, env, await userOf(request, env));
  }
  if (policy === "settings") {
    return settingsResponse(request, env, userId);
  }
  if (policy === "favorites") {
    return favoritesResponse(request, env, userId);
  }
  if (policy === "auth" || policy === "email") {
    return handleAuth(request, env);
  }
  if (policy === "route") {
    return routeChargersResponse(request, env);
  }
  if (policy === "status") {
    return statusResponse(request, env);
  }
  if (policy === "tiles") {
    const tile = parseTile(url.pathname);
    return tile
      ? tileResponse(request, env, tile, context)
      : json({ error: "Not found" }, { status: 404 });
  }
  if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/") {
    return redirectToLocalizedPage(request, env);
  }
  return env.ASSETS.fetch(request);
};

export default {
  async fetch(request, env, context) {
    const response = await route(request, env, context);
    return new URL(request.url).pathname.startsWith("/api/") ? withoutIndexing(response) : response;
  },

  // Awaited, not passed to waitUntil(): work after the handler returns is
  // cancelled after ~30 s, but a scheduled handler itself may run 15 minutes.
  async scheduled(controller, env) {
    if (controller.cron === STATUS_CRON) {
      await refreshStatuses(env, controller.scheduledTime);
      return;
    }
    // IMPORT_BUDGET_MS shortens a run, e.g. when trying the import locally.
    await runImport(env, { budgetMs: Number(env.IMPORT_BUDGET_MS) || undefined });
  },
};
