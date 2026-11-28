import { describe, expect, test } from "bun:test";
import { testD1 } from "./test-d1.js";
import { PLATFORMS, supportClickResponse } from "./support-clicks.js";
import { SUPPORT_LINKS } from "../../app/src/lib/support-links.js";

const NOW = Date.UTC(2026, 10, 23, 12);
const click = (body, url = "https://ev.chealt.com/api/support-clicks") =>
  new Request(url, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const counts = (env) =>
  env.DB.sqlite.query("SELECT day, platform, count FROM support_clicks ORDER BY platform").all();

describe("supportClickResponse", () => {
  test("knows every platform of the app's support links", () => {
    expect([...PLATFORMS].sort()).toEqual(SUPPORT_LINKS.map(({ id }) => id).sort());
  });

  test("counts clicks per platform and day", async () => {
    const env = { DB: testD1("../migrations/0012_support_clicks.sql") };
    for (const platform of ["ko-fi", "ko-fi", "github-sponsors"]) {
      expect((await supportClickResponse(click({ platform }), env, NOW)).status).toBe(204);
    }
    await supportClickResponse(click({ platform: "ko-fi" }), env, NOW + 24 * 60 * 60 * 1000);
    expect(counts(env)).toEqual([
      { day: "2026-11-23", platform: "github-sponsors", count: 1 },
      { day: "2026-11-23", platform: "ko-fi", count: 2 },
      { day: "2026-11-24", platform: "ko-fi", count: 1 },
    ]);
  });

  test("rejects unknown platforms, bad bodies and other methods", async () => {
    const env = { DB: testD1("../migrations/0012_support_clicks.sql") };
    expect((await supportClickResponse(click({ platform: "paypal" }), env, NOW)).status).toBe(400);
    expect((await supportClickResponse(click("{"), env, NOW)).status).toBe(400);
    expect(
      (await supportClickResponse(click({ platform: "ko-fi", pad: "x".repeat(300) }), env, NOW))
        .status
    ).toBe(413);
    expect(
      (await supportClickResponse(new Request("https://ev.chealt.com/api/support-clicks"), env))
        .status
    ).toBe(405);
    expect(counts(env)).toEqual([]);
  });

  test("doesn't count a pull request's preview", async () => {
    const env = {
      DB: testD1("../migrations/0012_support_clicks.sql"),
      PRODUCTION_HOSTS: "ev.chealt.com",
    };
    const response = await supportClickResponse(
      click(
        { platform: "ko-fi" },
        "https://my-branch-ev-maps.chealt.workers.dev/api/support-clicks"
      ),
      env,
      NOW
    );
    expect(response.status).toBe(204);
    expect(counts(env)).toEqual([]);
  });

  test("still answers when the database is down", async () => {
    const env = {
      DB: {
        prepare: () => {
          throw new Error("D1 is down");
        },
      },
    };
    expect((await supportClickResponse(click({ platform: "ko-fi" }), env, NOW)).status).toBe(204);
  });
});
