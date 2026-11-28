import { describe, expect, test } from "bun:test";
import { API_ROUTES } from "./api-routes.js";
import { guard, isBlockedAgent } from "./guard.js";

// The real routes' access, by name.
const ROUTE = Object.fromEntries(API_ROUTES.map((route) => [route.name, route]));

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const request = (headers = {}) =>
  new Request("https://ev.chealt.com/api/chargers/status", {
    headers: { "user-agent": CHROME, "cf-connecting-ip": "203.0.113.7", ...headers },
  });

// A rate limiter that allows `allowed` requests in all, recording the keys.
const limiter = (allowed = Infinity) => {
  const keys = [];
  return {
    keys,
    limit: async ({ key }) => {
      keys.push(key);
      return { success: keys.length <= allowed };
    },
  };
};

const signedOut = async () => null;
const ADA = { id: "user-1", email: "ada@example.com" };
const signedIn = async () => ADA;

describe("isBlockedAgent", () => {
  test("lets browsers in", () => {
    expect(isBlockedAgent(request())).toBe(false);
  });

  test("keeps bots, AI crawlers, scripts and requests without a user agent out", () => {
    for (const userAgent of [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
      "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
      "CCBot/2.0 (https://commoncrawl.org/faq/)",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "curl/8.7.1",
      "python-requests/2.32.3",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36",
      "",
    ]) {
      expect(isBlockedAgent(request({ "user-agent": userAgent }))).toBe(true);
    }
  });
});

describe("guard", () => {
  test("lets only admins use admin policies", async () => {
    const env = { ADMIN_LIMITER: limiter() };
    const admin = { id: "user-2", email: "grace@chealt.com" };
    const isAdmin = (user) => user.email.endsWith("@chealt.com");

    const { refused: signedOutResponse } = await guard(
      request(),
      env,
      ROUTE.admin,
      signedOut,
      isAdmin
    );
    expect(signedOutResponse.status).toBe(401);
    const { refused: userResponse } = await guard(request(), env, ROUTE.admin, signedIn, isAdmin);
    expect(userResponse.status).toBe(403);
    expect(await guard(request(), env, ROUTE.admin, async () => admin, isAdmin)).toEqual({
      userId: "user-2",
      user: admin,
    });
  });

  test("refuses bots", async () => {
    const { refused: response } = await guard(
      request({ "user-agent": "curl/8.7.1" }),
      {},
      ROUTE.tiles,
      signedOut
    );
    expect(response.status).toBe(403);
  });

  test("lets servers call webhooks", async () => {
    for (const name of ["github sponsors webhook", "ko-fi webhook"]) {
      expect(
        await guard(request({ "user-agent": "GitHub-Hookshot/1" }), {}, ROUTE[name], signedOut)
      ).toEqual({ userId: null, user: null });
      expect(await guard(request({ "user-agent": "" }), {}, ROUTE[name], signedOut)).toEqual({
        userId: null,
        user: null,
      });
    }
  });

  test("lets anyone load tiles, limited per IP address", async () => {
    const env = { TILE_LIMITER: limiter() };
    expect(await guard(request(), env, ROUTE.tiles, signedOut)).toEqual({
      userId: null,
      user: null,
    });
    expect(env.TILE_LIMITER.keys).toEqual(["tiles:ip:203.0.113.7"]);
  });

  test("asks to sign in for live availability and routes", async () => {
    for (const name of ["status", "route", "settings", "favorites"]) {
      const { refused: response } = await guard(request(), {}, ROUTE[name], signedOut);
      expect(response.status).toBe(401);
    }
  });

  test("limits signed-in users per user", async () => {
    const env = { STATUS_LIMITER: limiter() };
    expect(await guard(request(), env, ROUTE.status, signedIn)).toEqual({
      userId: "user-1",
      user: ADA,
    });
    expect(env.STATUS_LIMITER.keys).toEqual(["status:user:user-1"]);
  });

  test("says when the limit is reached", async () => {
    const env = { ROUTE_LIMITER: limiter(1) };
    expect(await guard(request(), env, ROUTE.route, signedIn)).toEqual({
      userId: "user-1",
      user: ADA,
    });
    const { refused: response } = await guard(request(), env, ROUTE.route, signedIn);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
  });
});
