// Every API route, by domain: the first one matching a request handles it
// (src/index.js), behind the guard with the route's access (src/guard.js).
// A route is { name, limiter, signedIn, admin, untraced, matches(request,
// url), handle({ request, env, context, url, userId, user, signedInUser }) };
// its limiter is a ratelimits binding in wrangler.toml, and untraced routes
// aren't recorded as traces (src/tracing.js).
//
// A new domain keeps its routes in its own module and adds one line here;
// put specific paths before general ones (tiles take /api/chargers/*).

import {
  adminRoutes as admin,
  testReportsRoutes as testReports,
  usageRoutes as usage,
} from "./admin-area.js";
import { routes as adminDashboard } from "@ev-maps/admin/admin-dashboard.js";
import { routes as auth } from "./auth.js";
import { routes as chargerReports } from "./charger-reports.js";
import { routes as chargerUnavailability } from "./charger-unavailability.js";
import { routes as chargerSuggestions } from "./charger-suggestions.js";
import { routes as errors } from "@ev-maps/admin/errors.js";
import { routes as favorites } from "./favorites.js";
import { routes as preferenceStats } from "./preference-stats.js";
import { routes as liveStatus } from "./live-status.js";
import { routes as performance } from "@ev-maps/admin/performance-stats.js";
import { routes as routeChargers } from "./route-chargers.js";
import { routes as settings } from "./settings.js";
import { routes as sponsorStats } from "./sponsor-stats.js";
import { routes as sponsorStatus } from "./sponsor-status.js";
import { routes as sponsorships } from "./sponsorships.js";
import { routes as supportClicks } from "./support-clicks.js";
import { routes as telemetry } from "@ev-maps/admin/telemetry.js";
import { routes as tiles } from "./tiles.js";

const API_ROUTES = [
  ...admin,
  ...adminDashboard,
  ...auth,
  ...chargerReports,
  ...chargerUnavailability,
  ...chargerSuggestions,
  ...errors,
  ...favorites,
  ...preferenceStats,
  ...liveStatus,
  ...performance,
  ...routeChargers,
  ...settings,
  ...sponsorStats,
  ...sponsorStatus,
  ...sponsorships,
  ...supportClicks,
  ...telemetry,
  ...testReports,
  ...usage,
  // Last: everything else under /api/chargers/.
  ...tiles,
];

export { API_ROUTES };
