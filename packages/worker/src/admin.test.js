import { describe, expect, test } from "bun:test";
import { usageStats } from "@ev-maps/admin/admin.js";
import {
  adminApiResponse,
  adminPageResponse,
  isAdmin,
  isAdminPage,
  mostFavorited,
} from "./admin-area.js";
import { testD1 } from "./test-d1.js";

const env = {
  ADMIN_EMAIL_DOMAIN: "chealt.com",
  ASSETS: {
    fetch: async () =>
      new Response("<h1>Admin</h1>", { headers: { "cache-control": "public, max-age=600" } }),
  },
};

describe("isAdmin", () => {
  test("only verified users at the admin domain", () => {
    expect(isAdmin(env, { id: "1", email: "grace@chealt.com" })).toBe(true);
    expect(isAdmin(env, { id: "1", email: "Grace@CHEALT.com" })).toBe(true);
    expect(isAdmin(env, { id: "1", email: "grace@notchealt.com" })).toBe(false);
    expect(isAdmin(env, { id: "1", email: "chealt.com@example.com" })).toBe(false);
    expect(isAdmin(env, null)).toBe(false);
    expect(isAdmin({}, { id: "1", email: "grace@chealt.com" })).toBe(false);
  });
});

describe("isAdminPage", () => {
  test("matches the admin pages in every language", () => {
    expect(isAdminPage("/en/admin/")).toBe(true);
    expect(isAdminPage("/hu/admin")).toBe(true);
    expect(isAdminPage("/pl/admin/errors/")).toBe(true);
    expect(isAdminPage("/en/administration/")).toBe(false);
    expect(isAdminPage("/en/hu/")).toBe(false);
  });
});

describe("adminPageResponse", () => {
  const request = new Request("https://ev.chealt.com/en/admin/");

  test("serves the page to admins, never from a shared cache", async () => {
    const response = await adminPageResponse(request, env, { id: "1", email: "grace@chealt.com" });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<h1>Admin</h1>");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  test("is not found for everyone else", async () => {
    expect((await adminPageResponse(request, env, null)).status).toBe(404);
    const user = { id: "2", email: "ada@example.com" };
    expect((await adminPageResponse(request, env, user)).status).toBe(404);
  });

  test("renders the errors page with the errors as its props", async () => {
    const db = testD1("../../admin/migrations/admin-migrations/0001_errors.sql");
    db.sqlite
      .prepare(
        "INSERT INTO errors (fingerprint, source, message, created_at) VALUES ('0000abcd', 'page', 'Boom', 1)"
      )
      .run();
    const calls = [];
    const render = async (renderedRequest, renderEnv, context) => {
      calls.push({ url: renderedRequest.url, props: context.props });
      return new Response("<h1>Errors</h1>", { headers: { "content-type": "text/html" } });
    };
    const admin = { id: "1", email: "grace@chealt.com" };
    const errorsPage = new Request("https://ev.chealt.com/en/admin/errors/?error=0000abcd");

    const response = await adminPageResponse(errorsPage, { ...env, ADMIN_DB: db }, admin, {
      render,
    });

    expect(await response.text()).toBe("<h1>Errors</h1>");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(calls[0].props.data.total).toBe(1);
    expect(calls[0].props.data.occurrences[0].message).toBe("Boom");
    // Static admin pages still come from the assets.
    const overview = await adminPageResponse(request, env, admin, { render });
    expect(await overview.text()).toBe("<h1>Admin</h1>");
    expect(calls).toHaveLength(1);
  });

  test("tells the page when its data couldn't be read", async () => {
    let props;
    const render = async (renderedRequest, renderEnv, context) => {
      props = context.props;
      return new Response("");
    };
    const broken = {
      prepare: () => {
        throw new Error("D1 is down");
      },
    };
    await adminPageResponse(
      new Request("https://ev.chealt.com/hu/admin/errors/"),
      { ...env, ADMIN_DB: broken },
      { id: "1", email: "grace@chealt.com" },
      { render }
    );
    expect(props).toEqual({ failed: true });
  });
});

describe("adminApiResponse", () => {
  test("says who the admin is", async () => {
    const response = await adminApiResponse(
      new Request("https://ev.chealt.com/api/admin/me"),
      env,
      {
        id: "1",
        email: "grace@chealt.com",
      }
    );
    expect(await response.json()).toEqual({ admin: true, email: "grace@chealt.com" });
  });
});

describe("adminApiResponse for errors", () => {
  const admin = { id: "1", email: "grace@chealt.com" };
  const get = async (testEnv, path) =>
    (await adminApiResponse(new Request(`https://ev.chealt.com${path}`), testEnv, admin)).json();

  // Two kinds of errors: "a" three times (two users), "b" once, later.
  const seeded = () => {
    const db = testD1("../../admin/migrations/admin-migrations/0001_errors.sql");
    const insert = db.sqlite.prepare(
      `INSERT INTO errors (fingerprint, source, name, message, stack, url, user_agent, user_id,
         created_at) VALUES (?, ?, 'TypeError', ?, 'stack', '/en/', 'Firefox', ?, ?)`
    );
    insert.run("aaaaaaaa", "page", "first a", "user-1", 1000);
    insert.run("aaaaaaaa", "page", "second a", "user-2", 2000);
    insert.run("aaaaaaaa", "page", "third a", null, 3000);
    insert.run("bbbbbbbb", "worker", "only b", null, 4000);
    return { ...env, ADMIN_DB: db };
  };

  test("groups errors, the most recently seen first, with the latest details", async () => {
    const { groups, page, pages, total } = await get(seeded(), "/api/admin/errors");
    expect({ page, pages, total }).toEqual({ page: 1, pages: 1, total: 2 });
    expect(
      groups.map(({ fingerprint, message, count, users, first_seen, last_seen }) => ({
        fingerprint,
        message,
        count,
        users,
        first_seen,
        last_seen,
      }))
    ).toEqual([
      {
        fingerprint: "bbbbbbbb",
        message: "only b",
        count: 1,
        users: 0,
        first_seen: 4000,
        last_seen: 4000,
      },
      {
        fingerprint: "aaaaaaaa",
        message: "third a",
        count: 3,
        users: 2,
        first_seen: 1000,
        last_seen: 3000,
      },
    ]);
  });

  test("lists one error's occurrences, newest first", async () => {
    const { occurrences, total } = await get(seeded(), "/api/admin/errors/aaaaaaaa");
    expect(total).toBe(3);
    expect(occurrences.map((occurrence) => occurrence.message)).toEqual([
      "third a",
      "second a",
      "first a",
    ]);
    expect(occurrences[0]).toMatchObject({ stack: "stack", user_agent: "Firefox", url: "/en/" });
  });

  test("sees an error when it last happened, whatever order it was stored in", async () => {
    const testEnv = seeded();
    testEnv.ADMIN_DB.sqlite
      .prepare(
        "INSERT INTO errors (fingerprint, source, message, created_at) VALUES (?, 'page', ?, ?)"
      )
      .run("aaaaaaaa", "late a, stored last", 500);
    const { groups } = await get(testEnv, "/api/admin/errors");
    const a = groups.find((group) => group.fingerprint === "aaaaaaaa");
    expect({ count: a.count, first_seen: a.first_seen, last_seen: a.last_seen }).toEqual({
      count: 4,
      first_seen: 500,
      last_seen: 3000,
    });
  });

  test("pages through many errors", async () => {
    const testEnv = seeded();
    const insert = testEnv.ADMIN_DB.sqlite.prepare(
      "INSERT INTO errors (fingerprint, source, message, created_at) VALUES (?, 'page', 'x', ?)"
    );
    for (let index = 0; index < 30; index++) {
      insert.run(index.toString(16).padStart(8, "0"), 10000 + index);
    }
    const second = await get(testEnv, "/api/admin/errors?page=2");
    expect({ page: second.page, pages: second.pages, total: second.total }).toEqual({
      page: 2,
      pages: 2,
      total: 32,
    });
    expect(second.groups).toHaveLength(7);
  });

  test("filters the groups by where they happened, browser, system, country and text", async () => {
    const testEnv = seeded();
    const insert = testEnv.ADMIN_DB.sqlite.prepare(
      `INSERT INTO errors (fingerprint, source, name, message, url, context, user_agent, country,
         created_at) VALUES (?, ?, 'TypeError', ?, ?, ?, ?, ?, ?)`
    );
    const chromeOnMac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Chrome/130.0 Safari/537.36";
    const firefoxOnWindows = "Mozilla/5.0 (Windows NT 10.0; Win64) Firefox/140.0";
    insert.run("cccccccc", "page", "canvas", "/hu/", null, chromeOnMac, "HU", 1500);
    insert.run("cccccccc", "page", "canvas", "/hu/", null, chromeOnMac, "HU", 2000);
    insert.run("dddddddd", "worker", "import failed", null, "import eipa PL", null, "PL", 3000);
    insert.run("eeeeeeee", "page", "storage", "/pl/", null, firefoxOnWindows, "HU", 2500);

    const bySource = await get(testEnv, "/api/admin/errors?source=worker");
    expect(bySource.groups.map(({ fingerprint }) => fingerprint)).toEqual(["bbbbbbbb", "dddddddd"]);

    const byBrowser = await get(testEnv, "/api/admin/errors?browser=Firefox");
    expect(
      byBrowser.groups.map(({ fingerprint, browser, os }) => ({ fingerprint, browser, os }))
    ).toEqual([{ fingerprint: "eeeeeeee", browser: "Firefox", os: "Windows" }]);

    const byOs = await get(testEnv, "/api/admin/errors?os=macOS");
    expect(byOs.groups.map(({ fingerprint, count }) => ({ fingerprint, count }))).toEqual([
      { fingerprint: "cccccccc", count: 2 },
    ]);

    const byCountry = await get(testEnv, "/api/admin/errors?country=HU");
    expect(byCountry.groups.map(({ fingerprint }) => fingerprint)).toEqual([
      "eeeeeeee",
      "cccccccc",
    ]);

    const byText = await get(testEnv, "/api/admin/errors?q=import");
    expect(byText.groups.map(({ fingerprint }) => fingerprint)).toEqual(["dddddddd"]);

    // The values the filters offer come from all the errors kept.
    expect(bySource.facets).toEqual({
      sources: ["worker", "page"],
      countries: ["HU", "PL"],
      // The seeded bare "Firefox" is no Firefox/… user agent: Other.
      browsers: ["Chrome", "Firefox", "Other"],
      oss: ["Other", "Windows", "macOS"],
    });
  });

  test("orders the groups by the chosen order", async () => {
    const testEnv = seeded();
    const insert = testEnv.ADMIN_DB.sqlite.prepare(
      "INSERT INTO errors (fingerprint, source, message, created_at) VALUES (?, 'page', ?, ?)"
    );
    insert.run("cccccccc", "canvas", 1500);
    insert.run("cccccccc", "canvas", 2000);

    const byCount = await get(testEnv, "/api/admin/errors?sort=count");
    expect(byCount.groups.map(({ fingerprint }) => fingerprint)).toEqual([
      "aaaaaaaa",
      "cccccccc",
      "bbbbbbbb",
    ]);

    const byFirstSeen = await get(testEnv, "/api/admin/errors?sort=first_seen");
    expect(byFirstSeen.groups.map(({ fingerprint }) => fingerprint)).toEqual([
      "bbbbbbbb",
      "cccccccc",
      "aaaaaaaa",
    ]);

    // An unknown order falls back to the default, the most recently seen.
    const unknown = await get(testEnv, "/api/admin/errors?sort=newest");
    expect(unknown.groups.map(({ fingerprint }) => fingerprint)).toEqual([
      "bbbbbbbb",
      "aaaaaaaa",
      "cccccccc",
    ]);
  });

  test("knows no other paths or methods", async () => {
    const testEnv = seeded();
    const response = await adminApiResponse(
      new Request("https://ev.chealt.com/api/admin/errors/not-hex"),
      testEnv,
      admin
    );
    expect(response.status).toBe(404);
    const post = await adminApiResponse(
      new Request("https://ev.chealt.com/api/admin/errors", { method: "POST" }),
      testEnv,
      admin
    );
    expect(post.status).toBe(405);
  });
});

describe("usageStats", () => {
  const db = () => {
    const testDb = testD1(
      "../../admin/migrations/admin-migrations/0001_errors.sql",
      "../../admin/migrations/admin-migrations/0002_usage.sql"
    );
    const insert = testDb.sqlite.prepare(
      "INSERT INTO usage_daily (day, event, dimension, count) VALUES (?, ?, ?, ?)"
    );
    insert.run("2026-11-21", "page_view", "en:home", 5);
    insert.run("2026-11-23", "page_view", "en:home", 2);
    insert.run("2026-11-23", "page_view", "hu:country", 7);
    insert.run("2026-11-23", "sign_in", "", 3);
    // Before the period.
    insert.run("2026-11-10", "page_view", "en:home", 100);
    return testDb;
  };

  test("sums each event per day and per dimension, over the period", async () => {
    const { days, events } = await usageStats(db(), 7, Date.UTC(2026, 10, 23, 15));
    expect(days).toEqual([
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
      "2026-11-23",
    ]);
    expect(events.page_view.total).toBe(14);
    expect(Object.values(events.page_view.byDay)).toEqual([0, 0, 0, 0, 5, 0, 9]);
    // Largest first, then by name.
    expect(Object.entries(events.page_view.byDimension)).toEqual([
      ["en:home", 7],
      ["hu:country", 7],
    ]);
    expect(events.sign_in).toMatchObject({ total: 3, byDimension: {} });
  });

  test("answers admins for 7, 30 or 90 days, else 30", async () => {
    const testEnv = { ...env, ADMIN_DB: db() };
    const admin = { id: "1", email: "grace@chealt.com" };
    const daysFor = async (query) =>
      (
        await (
          await adminApiResponse(
            new Request(`https://ev.chealt.com/api/admin/usage${query}`),
            testEnv,
            admin
          )
        ).json()
      ).days.length;
    expect(await daysFor("?days=7")).toBe(7);
    expect(await daysFor("?days=90")).toBe(90);
    expect(await daysFor("?days=1000")).toBe(30);
    expect(await daysFor("")).toBe(30);
  });
});

describe("mostFavorited", () => {
  test("lists the chargers most users have as a favorite, most first", async () => {
    const db = testD1("../migrations/0002_auth.sql", "../migrations/0005_favorites.sql");
    db.sqlite.exec("PRAGMA foreign_keys = OFF");
    const add = db.sqlite.prepare(
      "INSERT INTO favorites (user_id, charger_id, charger, added_at) VALUES (?, ?, ?, 1)"
    );
    const charger = (name) => JSON.stringify({ name });
    add.run("ada", "ocm:1", charger("Downtown"));
    add.run("grace", "ocm:1", charger("Downtown"));
    add.run("ada", "eipa:2", charger("Warsaw"));
    add.run("grace", "irve:3", "not json");

    expect(await mostFavorited(db)).toEqual([
      { id: "ocm:1", name: "Downtown", count: 2 },
      { id: "eipa:2", name: "Warsaw", count: 1 },
      { id: "irve:3", name: null, count: 1 },
    ]);
    expect(await mostFavorited(db, 1)).toHaveLength(1);
  });
});
