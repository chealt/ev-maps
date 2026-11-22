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

// The rate limit for each part of the API: its binding, and whether it
// needs a signed-in user (then the limit is per user).
const POLICIES = {
  auth: { limiter: "AUTH_LIMITER", signedIn: false },
  email: { limiter: "EMAIL_LIMITER", signedIn: false },
  tiles: { limiter: "TILE_LIMITER", signedIn: false },
  status: { limiter: "STATUS_LIMITER", signedIn: true },
  route: { limiter: "ROUTE_LIMITER", signedIn: true },
  settings: { limiter: "SETTINGS_LIMITER", signedIn: true },
  favorites: { limiter: "FAVORITES_LIMITER", signedIn: true },
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

// { refused: the response refusing the request } or { userId } (null when the
// policy doesn't need a signed-in user). `userIdOf(request)` resolves to the
// signed-in user's ID, or null.
const guard = async (request, env, policyName, userIdOf) => {
  if (isBlockedAgent(request)) {
    return { refused: errorResponse(403, "Automated access isn't allowed; see the terms of use.") };
  }
  const policy = POLICIES[policyName];
  let key = `ip:${request.headers.get("cf-connecting-ip") ?? "local"}`;
  let userId = null;
  if (policy.signedIn) {
    userId = await userIdOf(request);
    if (!userId) {
      return { refused: errorResponse(401, "Sign in to use this.") };
    }
    key = `user:${userId}`;
  }
  const limiter = env[policy.limiter];
  if (limiter && !(await limiter.limit({ key: `${policyName}:${key}` })).success) {
    return {
      refused: errorResponse(429, "Too many requests; try again in a minute.", {
        "retry-after": "60",
      }),
    };
  }
  return { userId };
};

export { guard, isBlockedAgent };
