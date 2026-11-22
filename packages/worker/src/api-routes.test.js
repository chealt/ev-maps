import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { API_ROUTES } from "./api-routes.js";
import { JOBS } from "./jobs.js";

const wranglerToml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");

// The ratelimits bindings of a [[ratelimits]] or [[env.local.ratelimits]]
// table, by name.
const limiters = (table) =>
  [
    ...wranglerToml.matchAll(
      new RegExp(`\\[\\[${table.replace(".", "\\.")}\\]\\]\\nname = "(\\w+)"`, "g")
    ),
  ].map((match) => match[1]);

describe("API_ROUTES", () => {
  test("every route says who may use it, and how much", () => {
    for (const route of API_ROUTES) {
      expect(typeof route.name).toBe("string");
      expect(route.limiter).toMatch(/^[A-Z0-9_]+_LIMITER$/);
      expect(typeof route.signedIn).toBe("boolean");
      expect(typeof route.matches).toBe("function");
      expect(typeof route.handle).toBe("function");
    }
    const names = API_ROUTES.map((route) => route.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test("every route's limiter is configured, for production and locally", () => {
    for (const { limiter } of API_ROUTES) {
      expect(limiters("ratelimits")).toContain(limiter);
      expect(limiters("env.local.ratelimits")).toContain(limiter);
    }
  });

  test("specific routes come before general ones", () => {
    const routeFor = (method, path) =>
      API_ROUTES.find((route) =>
        route.matches(
          new Request(`https://ev.chealt.com${path}`, { method }),
          new URL(`https://ev.chealt.com${path}`)
        )
      )?.name;
    expect(routeFor("POST", "/api/auth/sign-in/magic-link")).toBe("email");
    expect(routeFor("GET", "/api/auth/get-session")).toBe("auth");
    expect(routeFor("GET", "/api/chargers/status")).toBe("status");
    expect(routeFor("POST", "/api/chargers/route")).toBe("route");
    expect(routeFor("GET", "/api/chargers/12/2264/1434")).toBe("tiles");
    expect(routeFor("GET", "/api/admin/errors")).toBe("admin");
    expect(routeFor("GET", "/api/nothing")).toBeUndefined();
  });
});

describe("JOBS", () => {
  test("every job runs on a configured cron", () => {
    const crons = JSON.parse(wranglerToml.match(/^crons = (\[.*\])$/m)[1]);
    for (const job of JOBS) {
      expect(typeof job.name).toBe("string");
      expect(typeof job.run).toBe("function");
      expect(crons).toContain(job.cron);
    }
  });
});
