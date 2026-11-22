// Every API route, by domain: the first one matching a request handles it
// (src/index.js), behind the guard with the route's access (src/guard.js).
// A route is { name, limiter, signedIn, admin, untraced, matches(request,
// url), handle({ request, env, context, url, userId, user, signedInUser }) };
// its limiter is a ratelimits binding in wrangler.toml, and untraced routes
// aren't recorded as traces (src/tracing.js).
//
// A new domain keeps its routes in its own module and adds one line here;
// put specific paths before general ones (tiles take /api/chargers/*).

import { routes as admin } from "./admin.js";
import { routes as auth } from "./auth.js";
import { routes as errors } from "./errors.js";
import { routes as favorites } from "./favorites.js";
import { routes as liveStatus } from "./live-status.js";
import { routes as routeChargers } from "./route-chargers.js";
import { routes as settings } from "./settings.js";
import { routes as telemetry } from "./telemetry.js";
import { routes as tiles } from "./tiles.js";
import { routes as usage } from "./usage.js";

const API_ROUTES = [
  ...admin,
  ...auth,
  ...errors,
  ...favorites,
  ...liveStatus,
  ...routeChargers,
  ...settings,
  ...telemetry,
  ...usage,
  // Last: everything else under /api/chargers/.
  ...tiles,
];

export { API_ROUTES };
