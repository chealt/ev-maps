# The API: routes, access and rate limits

## Routes by domain

Each domain of the Worker keeps its API routes in its own module, e.g.
`src/favorites.js` or `src/tiles.js`, as a `routes` list:

```javascript
const routes = [
  {
    name: "favorites",
    limiter: "FAVORITES_LIMITER", // a ratelimits binding in wrangler.toml
    signedIn: true,
    admin: false,
    matches: (request, url) => isFavoritesPath(url.pathname),
    handle: ({ request, env, context, url, userId, user, signedInUser }) => ...,
  },
];
```

`src/api-routes.js` lists every domain's routes, one line each, specific
paths before general ones (the tiles take the rest of `/api/chargers/`).
`src/index.js` hands a request to the first route that matches, behind the
guard. Scheduled jobs work the same way: each domain exports `jobs`
(`{ name, cron, run }`), `src/jobs.js` lists them, and a failing job is
recorded without stopping the others.

`src/api-routes.test.js` checks that every route is complete, that its
limiter is configured for production and locally, and that every job's cron
is one of `wrangler.toml`'s triggers.

## Access and rate limits

The guard (`src/guard.js`) gives bots and AI crawlers a 403 from the whole
API. A route open to everyone is limited per IP address; one that needs a
signed-in user (with a verified email) is limited per user, and an admin
route also needs an admin (403 otherwise). Signed out, the page shows those
features with a sign-in button instead. The limits are Cloudflare's rate
limiting: `ratelimits` in `wrangler.toml`, listed in
[Deployment](../DEPLOYMENT.md).
