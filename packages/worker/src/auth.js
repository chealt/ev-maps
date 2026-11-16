// Sign-in with Better Auth (https://www.better-auth.com): OAuth with each
// provider, and users and sessions in D1 (migrations/0002_auth.sql). The
// session is an httpOnly cookie, so signing in survives a reload. Its API is
// /api/auth/*, e.g. /api/auth/get-session.

import { betterAuth } from "better-auth";

const AUTH_PATH = "/api/auth";
// Which providers have credentials, so the page only offers those.
const PROVIDERS_PATH = "/api/sign-in-providers";

// Only providers with credentials are offered; see docs/DEPLOYMENT.md.
const socialProviders = (env) => ({
  ...(env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET && {
      google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
    }),
});

// Better Auth needs the site's URL for the OAuth callbacks and its origin
// checks. Every deployment has its own (production, previews, local), so it's
// the request's, unless BETTER_AUTH_URL sets it, e.g. behind the dev
// server's proxy. One instance per URL, reused while the Worker runs.
const instances = new Map();

const authFor = (env, request) => {
  const baseURL = env.BETTER_AUTH_URL || new URL(request.url).origin;
  if (!instances.has(baseURL)) {
    instances.set(
      baseURL,
      betterAuth({
        baseURL,
        basePath: AUTH_PATH,
        secret: env.BETTER_AUTH_SECRET,
        database: env.DB,
        socialProviders: socialProviders(env),
        telemetry: { enabled: false },
      })
    );
  }
  return instances.get(baseURL);
};

const isAuthPath = (pathname) =>
  pathname === PROVIDERS_PATH || pathname.startsWith(`${AUTH_PATH}/`);

const providersResponse = (env) =>
  new Response(JSON.stringify({ providers: Object.keys(socialProviders(env)) }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });

const handleAuth = (request, env) =>
  new URL(request.url).pathname === PROVIDERS_PATH
    ? providersResponse(env)
    : authFor(env, request).handler(request);

export { handleAuth, isAuthPath };
