// The ev-maps Worker. Static assets, including the country pages, are served
// directly; the Worker runs for:
// - /api/*: each domain's routes (src/api-routes.js), behind the guard
//   (bots, sign-in, admins, rate limits; src/guard.js)
// - pages that need it: the admin pages, only for admins, and the redirect
//   of / to the visitor's language and country (src/page-routes.js)
// and runs each domain's scheduled jobs (src/jobs.js).

import { isAdmin } from "./admin.js";
import { API_ROUTES } from "./api-routes.js";
import { renderAppPage } from "./app-server.js";
import { userOf } from "./auth.js";
import { recordWorkerError } from "./errors.js";
import { guard } from "./guard.js";
import { JOBS } from "./jobs.js";
import { PAGE_ROUTES } from "./page-routes.js";
import { finishTrace, setTraceRoute, startTrace, tracedEnv, withTrace } from "./tracing.js";

const json = (data, { status = 200, headers = {} } = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

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
    if (!apiRoute.untraced) {
      setTraceRoute(apiRoute.name);
    }
    const signedInUser = () => userOf(request, env);
    const guarded = await guard(request, env, apiRoute, signedInUser, (user) => isAdmin(env, user));
    if (guarded.refused) {
      return guarded.refused;
    }
    return apiRoute.handle({ request, env, context, url, ...guarded, signedInUser });
  }
  const pageRoute = PAGE_ROUTES.find((candidate) => candidate.matches(request, url));
  if (pageRoute) {
    setTraceRoute(pageRoute.name);
    return pageRoute.handle({
      request,
      env,
      context,
      url,
      signedInUser: () => userOf(request, env),
      renderAppPage,
    });
  }
  return env.ASSETS.fetch(request);
};

export default {
  // Each request is traced (src/tracing.js): its D1 queries are spans of it,
  // and sampled, slow or failed traces are recorded after the response.
  async fetch(request, env, context) {
    const isApi = new URL(request.url).pathname.startsWith("/api/");
    const trace = startTrace(request, env);
    return withTrace(trace, async () => {
      let response;
      try {
        response = await route(request, tracedEnv(env), context);
      } catch (error) {
        console.error("Request failed:", error);
        context.waitUntil(recordWorkerError(env, error, { request }));
        response = isApi
          ? json({ error: "Something went wrong" }, { status: 500 })
          : new Response("Something went wrong", { status: 500 });
      }
      context.waitUntil(finishTrace(env, trace, { request, status: response.status }));
      return isApi ? withoutIndexing(response) : response;
    });
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
