import { afterEach, describe, expect, test } from "bun:test";
import { fetchJson } from "./fetch-json.js";

// The one test that fakes the global fetch: fetchJson's own.
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("fetchJson", () => {
  test("returns the response's JSON, with the request as given", async () => {
    const requests = [];
    globalThis.fetch = async (url, init) => {
      requests.push({ url, init });
      return Response.json({ chargers: [] });
    };
    expect(await fetchJson("/api/x", { method: "POST" })).toEqual({ chargers: [] });
    expect(requests).toEqual([{ url: "/api/x", init: { method: "POST" } }]);
  });

  test("throws an error with the status when the response isn't OK", async () => {
    globalThis.fetch = async () => new Response("", { status: 401 });
    const error = await fetchJson("/api/x").catch((caught) => caught);
    expect(error.message).toBe("/api/x failed: 401");
    expect(error.status).toBe(401);
  });
});
