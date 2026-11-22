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
  // Only Chealt's own people (src/admin.js).
  admin: { limiter: "ADMIN_LIMITER", signedIn: true, admin: true },
  // Pages reporting their errors (src/errors.js).
  errors: { limiter: "ERRORS_LIMITER", signedIn: false },
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
// policy doesn't need a signed-in user), with { user }. `userOf(request)`
// resolves to the signed-in user, { id, email }, or null; `isAdmin(user)`
// says if they may use admin policies.
const guard = async (request, env, policyName, userOf, isAdmin = () => false) => {
  if (isBlockedAgent(request)) {
    return { refused: errorResponse(403, "Automated access isn't allowed; see the terms of use.") };
  }
  const policy = POLICIES[policyName];
  let key = `ip:${request.headers.get("cf-connecting-ip") ?? "local"}`;
  let user = null;
  if (policy.signedIn) {
    user = await userOf(request);
    if (!user) {
      return { refused: errorResponse(401, "Sign in to use this.") };
    }
    if (policy.admin && !isAdmin(user)) {
      return { refused: errorResponse(403, "Only for admins.") };
    }
    key = `user:${user.id}`;
  }
  const limiter = env[policy.limiter];
  if (limiter && !(await limiter.limit({ key: `${policyName}:${key}` })).success) {
    return {
      refused: errorResponse(429, "Too many requests; try again in a minute.", {
        "retry-after": "60",
      }),
    };
  }
  return { userId: user?.id ?? null, user };
};

export { guard, isBlockedAgent };
