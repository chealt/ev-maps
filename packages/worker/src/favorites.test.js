import { describe, expect, test } from "bun:test";
import { favoritesResponse, isFavoritesPath, validCharger } from "./favorites.js";

const CHARGER = {
  id: "ocm:123",
  name: "Downtown",
  address: "1 Main St",
  location: { lat: 47.5, lng: 19.04 },
};

// A D1 stand-in holding the favorites in a Map, enough for favorites.js's
// statements.
const fakeDb = () => {
  const rows = new Map();
  const statement = (sql, values = []) => ({
    bind: (...bound) => statement(sql, bound),
    all: async () => ({
      results: [...rows.values()]
        .filter((row) => row.user_id === values[0])
        .sort((a, b) => b.added_at - a.added_at),
    }),
    first: async () => ({
      count: [...rows.values()].filter(
        (row) => row.user_id === values[0] && row.charger_id !== values[1]
      ).length,
    }),
    run: async () => {
      if (sql.startsWith("INSERT")) {
        const [userId, chargerId, charger, addedAt] = values;
        const key = `${userId}/${chargerId}`;
        rows.set(key, {
          user_id: userId,
          charger_id: chargerId,
          charger,
          added_at: rows.get(key)?.added_at ?? addedAt,
        });
      } else {
        rows.delete(`${values[0]}/${values[1]}`);
      }
    },
  });
  return { prepare: (sql) => statement(sql), rows };
};

const call = (env, method, path, body, userId = "user-1") =>
  favoritesResponse(
    new Request(`https://ev.chealt.com${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
    userId
  );

describe("isFavoritesPath", () => {
  test("matches the list and one favorite", () => {
    expect(isFavoritesPath("/api/favorites")).toBe(true);
    expect(isFavoritesPath("/api/favorites/ocm%3A123")).toBe(true);
    expect(isFavoritesPath("/api/favorites/a/b")).toBe(false);
    expect(isFavoritesPath("/api/favourites")).toBe(false);
  });
});

describe("validCharger", () => {
  test("accepts the page's charger for its ID", () => {
    expect(validCharger(CHARGER, "ocm:123")).toBe(true);
    expect(validCharger({ ...CHARGER, name: null }, "ocm:123")).toBe(true);
  });

  test("refuses another ID, a missing or wrong location and long text", () => {
    expect(validCharger(CHARGER, "ocm:124")).toBe(false);
    expect(validCharger({ ...CHARGER, location: undefined }, "ocm:123")).toBe(false);
    expect(validCharger({ ...CHARGER, location: { lat: 91, lng: 0 } }, "ocm:123")).toBe(false);
    expect(validCharger({ ...CHARGER, name: "x".repeat(301) }, "ocm:123")).toBe(false);
    expect(validCharger(null, "ocm:123")).toBe(false);
  });
});

describe("favoritesResponse", () => {
  test("saves, lists newest first, and removes favorites per user", async () => {
    const env = { DB: fakeDb() };
    const other = { ...CHARGER, id: "eipa:9", name: "Other" };
    await call(env, "PUT", "/api/favorites/ocm%3A123", { charger: CHARGER, addedAt: 1 });
    await call(env, "PUT", "/api/favorites/eipa%3A9", { charger: other, addedAt: 2 });
    await call(env, "PUT", "/api/favorites/ocm%3A123", { charger: CHARGER, addedAt: 3 }, "user-2");

    const listed = await (await call(env, "GET", "/api/favorites")).json();
    expect(listed.favorites).toEqual([
      { charger: other, addedAt: 2 },
      { charger: CHARGER, addedAt: 1 },
    ]);

    await call(env, "DELETE", "/api/favorites/eipa%3A9");
    const after = await (await call(env, "GET", "/api/favorites")).json();
    expect(after.favorites.map((favorite) => favorite.charger.id)).toEqual(["ocm:123"]);
  });

  test("refuses invalid favorites, IDs and methods", async () => {
    const env = { DB: fakeDb() };
    const status = async (...args) => (await call(env, ...args)).status;
    expect(await status("PUT", "/api/favorites/ocm%3A123", { charger: CHARGER })).toBe(400);
    expect(await status("PUT", "/api/favorites/ocm%3A999", { charger: CHARGER, addedAt: 1 })).toBe(
      400
    );
    expect(await status("PUT", "/api/favorites/not-an-id", { charger: CHARGER, addedAt: 1 })).toBe(
      400
    );
    expect(await status("POST", "/api/favorites")).toBe(405);
    expect(env.DB.rows.size).toBe(0);
  });
});
