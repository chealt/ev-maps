import { describe, expect, test } from "bun:test";
import { isRealTraffic } from "@ev-maps/admin/real-traffic.js";

const env = { PRODUCTION_HOSTS: "ev.chealt.com, ev-maps.chealt.workers.dev" };
const at = (url) => new Request(url);

describe("isRealTraffic", () => {
  test("is production's addresses", () => {
    expect(isRealTraffic(at("https://ev.chealt.com/en/"), env)).toBe(true);
    expect(isRealTraffic(at("https://ev-maps.chealt.workers.dev/api/x"), env)).toBe(true);
  });

  test("isn't a pull request's preview", () => {
    expect(isRealTraffic(at("https://fix-thing-ev-maps.chealt.workers.dev/en/"), env)).toBe(false);
  });

  test("is everything without the setting, as in local development", () => {
    expect(isRealTraffic(at("http://localhost:8787/api/x"), {})).toBe(true);
  });
});
