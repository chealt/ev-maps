// Who may use the API, and how much (see the terms of use): no bots or AI
// crawlers at all, the charger tiles and sign-in for everyone, and the rest
// (live availability, chargers along a route, settings, favorites) only for
// signed-in users. Each part is rate limited with Cloudflare's rate limiting
// (wrangler.toml's ratelimits): per user when signed in, per IP address
// otherwise.

// Automated clients identify themselves in their user agent; browsers don't.
const BOT_USER_AGENT =
  /bot\b|bot\/|crawl|spider|scrap|slurp|headless|curl\/|wget|python|httpx|aiohttp|go-http-client|java\/|okhttp|axios|node-fetch|undici|libwww|perl|ruby|php\/|postman|insomnia|GPTBot|ClaudeBot|anthropic|CCBot|PerplexityBot|Bytespider|Amazonbot|Diffbot|cohere|img2dataset/i;

const isBlockedAgent = (request) => {
  const userAgent = request.headers.get("user-agent") ?? "";
  return !userAgent || BOT_USER_AGENT.test(userAgent);
};

const errorResponse = (status, error, headers = {}) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });

// { refused: the response refusing the request } or { userId, user } (null
// when the route doesn't need a signed-in user). `route` is an API route's
// access (src/api-routes.js): { name, limiter (a ratelimits binding in
// wrangler.toml), signedIn, admin, webhook }; a webhook route takes
// requests from servers (e.g. GitHub's or Ko-fi's), so it lets automated
// user agents in and checks the request's signature itself. `userOf(request)` resolves to the
// signed-in user, { id, email }, or null; `isAdmin(user)` says if they may
// use admin routes.
const guard = async (request, env, route, userOf, isAdmin = () => false) => {
  if (!route.webhook && isBlockedAgent(request)) {
    return { refused: errorResponse(403, "Automated access isn't allowed; see the terms of use.") };
  }
  let key = `ip:${request.headers.get("cf-connecting-ip") ?? "local"}`;
  let user = null;
  if (route.signedIn) {
    user = await userOf(request);
    if (!user) {
      return { refused: errorResponse(401, "Sign in to use this.") };
    }
    if (route.admin && !isAdmin(user)) {
      return { refused: errorResponse(403, "Only for admins.") };
    }
    key = `user:${user.id}`;
  }
  const limiter = env[route.limiter];
  if (limiter && !(await limiter.limit({ key: `${route.name}:${key}` })).success) {
    return {
      refused: errorResponse(429, "Too many requests; try again in a minute.", {
        "retry-after": "60",
      }),
    };
  }
  return { userId: user?.id ?? null, user };
};

export { guard, isBlockedAgent };
