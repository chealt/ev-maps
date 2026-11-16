// The ev-maps Worker. Static assets, including the country pages, are served
// directly; the Worker only runs for:
// - /api/chargers/{z}/{x}/{y}: chargers in a map tile, from D1
// - /: redirects to the page for the visitor's language and country
// It also runs the charger import on a schedule (see import/index.js).

import { TILE_FORMAT_VERSION, tileBounds } from "@ev-maps/tiles";
import { chargersInBounds, toClientCharger } from "./db.js";
import { withoutDuplicates } from "./duplicates.js";
import { runImport } from "./import/index.js";

const MAX_CHARGERS_PER_TILE = 2000;
const MAX_TILE_ZOOM = 18;
// The data changes weekly: browsers keep tiles for an hour, the edge a day.
const TILE_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400";
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
    { chargers: withoutDuplicates(rows.map(toClientCharger)), full },
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

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname.startsWith("/api/chargers/")) {
      const tile = parseTile(url.pathname);
      return tile
        ? tileResponse(request, env, tile, context)
        : json({ error: "Not found" }, { status: 404 });
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/") {
      return redirectToLocalizedPage(request, env);
    }
    return env.ASSETS.fetch(request);
  },

  // Awaited, not passed to waitUntil(): work after the handler returns is
  // cancelled after ~30 s, but a scheduled handler itself may run 15 minutes.
  async scheduled(controller, env) {
    // IMPORT_BUDGET_MS shortens a run, e.g. when trying the import locally.
    await runImport(env, { budgetMs: Number(env.IMPORT_BUDGET_MS) || undefined });
  },
};
