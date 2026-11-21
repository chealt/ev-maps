import { describe, expect, test } from "bun:test";
import { guard, isBlockedAgent } from "./guard.js";

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
const signedIn = async () => "user-1";

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
  test("refuses bots", async () => {
    const response = await guard(request({ "user-agent": "curl/8.7.1" }), {}, "tiles", signedOut);
    expect(response.status).toBe(403);
  });

  test("lets anyone load tiles, limited per IP address", async () => {
    const env = { TILE_LIMITER: limiter() };
    expect(await guard(request(), env, "tiles", signedOut)).toBeNull();
    expect(env.TILE_LIMITER.keys).toEqual(["tiles:ip:203.0.113.7"]);
  });

  test("asks to sign in for live availability and routes", async () => {
    for (const policy of ["status", "route"]) {
      const response = await guard(request(), {}, policy, signedOut);
      expect(response.status).toBe(401);
    }
  });

  test("limits signed-in users per user", async () => {
    const env = { STATUS_LIMITER: limiter() };
    expect(await guard(request(), env, "status", signedIn)).toBeNull();
    expect(env.STATUS_LIMITER.keys).toEqual(["status:user:user-1"]);
  });

  test("says when the limit is reached", async () => {
    const env = { ROUTE_LIMITER: limiter(1) };
    expect(await guard(request(), env, "route", signedIn)).toBeNull();
    const response = await guard(request(), env, "route", signedIn);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
  });
});
