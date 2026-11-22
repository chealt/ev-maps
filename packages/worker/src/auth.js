// Sign-in with Better Auth (https://www.better-auth.com): OAuth with each
// provider, an emailed sign-in link (which verifies the address), and
// passkeys a signed-in user adds; users and sessions in D1
// (migrations/0002_auth.sql, 0007_passkeys.sql). The session is an httpOnly
// cookie, so signing in survives a reload. Its API is /api/auth/*, e.g.
// /api/auth/get-session.

import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { appleClientSecret, hasAppleCredentials } from "./apple-client-secret.js";
import { canSendEmail, sendSignInLink } from "./email.js";

const AUTH_PATH = "/api/auth";
// Which providers have credentials, so the page only offers those.
const PROVIDERS_PATH = "/api/sign-in-providers";
// Apple sends the user back with a form POST from its own site. Better Auth
// turns it into a GET on the same callback (so the state cookie is sent), and
// its Apple guide asks to trust this origin.
const APPLE_ORIGIN = "https://appleid.apple.com";
// Instances are recreated daily, which also signs a new Apple client secret.
const INSTANCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SIGN_IN_LINK_SECONDS = 15 * 60;

// Only providers with credentials are offered; see docs/DEPLOYMENT.md. A
// user who signs in with another provider later, with the same verified
// email, gets the same account (Better Auth's implicit account linking).
const socialProviders = (env, { appleSecret } = {}) => ({
  ...(env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET && {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        // Always let the user choose the Google account, instead of Google
        // picking the one the browser last used.
        prompt: "select_account",
      },
    }),
  // A GitHub App, not an OAuth App: only a GitHub App takes several callback
  // URLs (production, the shared preview and localhost).
  ...(env.GITHUB_CLIENT_ID &&
    env.GITHUB_CLIENT_SECRET && {
      github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
    }),
  // An app registration in Microsoft Entra ID; the "common" tenant takes both
  // personal and work or school accounts.
  ...(env.MICROSOFT_CLIENT_ID &&
    env.MICROSOFT_CLIENT_SECRET && {
      microsoft: {
        clientId: env.MICROSOFT_CLIENT_ID,
        clientSecret: env.MICROSOFT_CLIENT_SECRET,
        tenantId: "common",
        prompt: "select_account",
      },
    }),
  // A Services ID, signed in with a JWT the Worker signs (apple-client-secret.js).
  ...(appleSecret && { apple: { clientId: env.APPLE_CLIENT_ID, clientSecret: appleSecret } }),
});

// A broken Apple key shouldn't stop the other providers: without a secret,
// Apple is left out.
const appleSecretFor = async (env) => {
  if (!hasAppleCredentials(env)) {
    return undefined;
  }
  try {
    return await appleClientSecret(env);
  } catch (error) {
    console.error("Sign in with Apple is off: could not sign its client secret:", error);
    return undefined;
  }
};

// The Better Auth instance, and the providers it can sign in with.
const createAuth = async (env, baseURL) => {
  const appleSecret = await appleSecretFor(env);
  const providers = socialProviders(env, { appleSecret });
  const { hostname, origin } = new URL(baseURL);
  const auth = betterAuth({
    baseURL,
    basePath: AUTH_PATH,
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    socialProviders: providers,
    trustedOrigins: appleSecret ? [APPLE_ORIGIN] : [],
    telemetry: { enabled: false },
    plugins: [
      // New users are created by their first link: no account without a
      // verified email.
      magicLink({
        expiresIn: SIGN_IN_LINK_SECONDS,
        sendMagicLink: ({ email, url }) => sendSignInLink(env, { email, url }),
      }),
      // Only for signed-in users (the plugin's default), so every passkey
      // belongs to a verified email. Each deployment's own host.
      passkey({ rpID: hostname, rpName: "EV Maps", origin }),
    ],
    // The session, signed, in a cookie for 5 minutes: checking who's signed
    // in (e.g. for every status request) doesn't need the database then.
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  });
  // Passkeys always; email where it can be sent (or locally, where the link
  // is logged).
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  const methods = [
    ...Object.keys(providers),
    "passkey",
    ...(canSendEmail(env) || isLocal ? ["email"] : []),
  ];
  return { auth, providers: methods };
};

// Better Auth needs the site's URL for the OAuth callbacks and its origin
// checks. Every deployment has its own (production, previews, local), so it's
// the request's, unless BETTER_AUTH_URL sets it, e.g. behind the dev
// server's proxy. One instance per URL, reused for a day.
const instances = new Map();

const authFor = (env, request) => {
  const baseURL = env.BETTER_AUTH_URL || new URL(request.url).origin;
  const cached = instances.get(baseURL);
  if (!cached || Date.now() - cached.createdAt > INSTANCE_MAX_AGE_MS) {
    instances.set(baseURL, { auth: createAuth(env, baseURL), createdAt: Date.now() });
  }
  return instances.get(baseURL).auth;
};

const isAuthPath = (pathname) =>
  pathname === PROVIDERS_PATH || pathname.startsWith(`${AUTH_PATH}/`);

const providersResponse = (providers) =>
  new Response(JSON.stringify({ providers }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });

const handleAuth = async (request, env) => {
  const { auth, providers } = await authFor(env, request);
  return new URL(request.url).pathname === PROVIDERS_PATH
    ? providersResponse(providers)
    : auth.handler(request);
};

// The signed-in user, { id, email }, or null: only users with a verified
// email count as signed in for the rest of the API.
const userOf = async (request, env) => {
  const { auth } = await authFor(env, request);
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  const user = session?.user;
  return user?.emailVerified ? { id: user.id, email: user.email } : null;
};

export { handleAuth, isAuthPath, userOf };
