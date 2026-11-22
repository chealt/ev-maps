// GET / redirects to the page for the visitor's language and country.

const DEFAULT_LANGUAGE = "en";
// Set by the app's language picker; it wins over the browser's languages.
const LANGUAGE_COOKIE = "ev-maps-language";
// Each candidate language costs a lookup in the static assets.
const MAX_LANGUAGES_TRIED = 4;

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

const pageRoutes = [
  {
    name: "language redirect",
    matches: (request, url) =>
      (request.method === "GET" || request.method === "HEAD") && url.pathname === "/",
    handle: ({ request, env }) => redirectToLocalizedPage(request, env),
  },
];

export { pageRoutes, preferredLanguages };
