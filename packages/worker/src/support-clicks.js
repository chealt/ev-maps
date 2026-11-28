// POST /api/support-clicks: a click on one of the account menu's support
// links (packages/app/src/lib/support-links.js), sent with
// navigator.sendBeacon as { platform }. Counted per platform and UTC day in
// support_clicks, for the admin area's sponsor stats (#420); nothing about
// who clicked is stored. Previews (isRealTraffic) aren't counted, and the
// route's limiter caps how many one client can send.

import { isRealTraffic } from "@ev-maps/admin/real-traffic.js";

const SUPPORT_CLICKS_PATH = "/api/support-clicks";
const MAX_BODY_BYTES = 256;
// The ids of SUPPORT_LINKS in packages/app/src/lib/support-links.js; the
// unit tests check that they match.
const PLATFORMS = new Set(["github-sponsors", "ko-fi", "buycoffee"]);

const dayOf = (time) => new Date(time).toISOString().slice(0, 10);

const supportClickResponse = async (request, env, now = Date.now()) => {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }
  let platform;
  try {
    ({ platform } = JSON.parse(text) ?? {});
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!PLATFORMS.has(platform)) {
    return new Response(null, { status: 400 });
  }
  if (env.DB && isRealTraffic(request, env)) {
    try {
      await env.DB.prepare(
        `INSERT INTO support_clicks (day, platform, count) VALUES (?, ?, 1)
         ON CONFLICT (day, platform) DO UPDATE SET count = count + 1`
      )
        .bind(dayOf(now), platform)
        .run();
    } catch (error) {
      console.error("Could not count the support click:", error);
    }
  }
  return new Response(null, { status: 204 });
};

const routes = [
  {
    name: "support clicks",
    limiter: "SUPPORT_LIMITER",
    signedIn: false,
    matches: (request, url) => url.pathname === SUPPORT_CLICKS_PATH,
    handle: ({ request, env }) => supportClickResponse(request, env),
  },
];

export { PLATFORMS, routes, supportClickResponse };
