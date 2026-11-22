// The ev-maps Worker. Static assets, including the country pages, are served
// directly; the Worker runs for:
// - /api/*: each domain's routes (src/api-routes.js), behind the guard
//   (bots, sign-in, admins, rate limits; src/guard.js)
// - /{lang}/admin*: the admin pages, only for admins (src/admin.js)
// - /: redirects to the page for the visitor's language and country
// and runs each domain's scheduled jobs (src/jobs.js).

import { adminPageResponse, isAdmin, isAdminPage } from "./admin.js";
import { API_ROUTES } from "./api-routes.js";
import { userOf } from "./auth.js";
import { recordWorkerError } from "./errors.js";
import { guard } from "./guard.js";
import { JOBS } from "./jobs.js";

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

const route = async (request, env, context) => {
  const url = new URL(request.url);
  const apiRoute = API_ROUTES.find((candidate) => candidate.matches(request, url));
  if (apiRoute) {
    const signedInUser = () => userOf(request, env);
    const guarded = await guard(request, env, apiRoute, signedInUser, (user) => isAdmin(env, user));
    if (guarded.refused) {
      return guarded.refused;
    }
    return apiRoute.handle({ request, env, context, url, ...guarded, signedInUser });
  }
  if (isAdminPage(url.pathname)) {
    return adminPageResponse(request, env, await userOf(request, env));
  }
  if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/") {
    return redirectToLocalizedPage(request, env);
  }
  return env.ASSETS.fetch(request);
};

export default {
  async fetch(request, env, context) {
    const isApi = new URL(request.url).pathname.startsWith("/api/");
    let response;
    try {
      response = await route(request, env, context);
    } catch (error) {
      console.error("Request failed:", error);
      context.waitUntil(recordWorkerError(env, error, { request }));
      response = isApi
        ? json({ error: "Something went wrong" }, { status: 500 })
        : new Response("Something went wrong", { status: 500 });
    }
    return isApi ? withoutIndexing(response) : response;
  },

  // Each scheduled job of the cron that fired (src/jobs.js), in order; one
  // failing doesn't stop the others. Awaited, not passed to waitUntil():
  // work after the handler returns is cancelled after ~30 s, but a scheduled
  // handler itself may run 15 minutes.
  async scheduled(controller, env) {
    for (const job of JOBS.filter((candidate) => candidate.cron === controller.cron)) {
      try {
        await job.run(env, controller);
      } catch (error) {
        console.error(`Job ${job.name} failed:`, error);
        await recordWorkerError(env, error, { context: `job ${job.name}` });
      }
    }
  },
};
