import { describe, expect, test } from "bun:test";
import { preferenceStats, routes } from "./preference-stats.js";
import { testD1 } from "./test-d1.js";

const NOW = Date.UTC(2026, 10, 27);
const AT = { lat: 47.5, lng: 19.05 };
const route = (from, to) => ({
  origin: { label: from, location: AT },
  destination: { label: to, location: AT },
  filters: {},
  plannedAt: NOW,
});

const createEnv = async (users) => {
  const DB = testD1(
    "../migrations/0002_auth.sql",
    "../migrations/0004_user_settings.sql",
    "../migrations/0007_passkeys.sql"
  );
  const ADMIN_DB = testD1("../../admin/migrations/admin-migrations/0002_usage.sql");
  for (const [index, { providers = [], passkey, settings }] of users.entries()) {
    const id = `user-${index}`;
    await DB.prepare(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
       VALUES (?, ?, ?, 1, 0, 0)`
    )
      .bind(id, id, `${id}@example.com`)
      .run();
    for (const provider of providers) {
      await DB.prepare(
        `INSERT INTO "account" (id, "accountId", "providerId", "userId", "createdAt", "updatedAt")
         VALUES (?, ?, ?, ?, 0, 0)`
      )
        .bind(`${id}-${provider}`, id, provider, id)
        .run();
    }
    if (passkey) {
      await DB.prepare(
        `INSERT INTO "passkey" (id, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp")
         VALUES (?, 'key', ?, ?, 0, 'singleDevice', 0)`
      )
        .bind(`${id}-passkey`, id, `${id}-credential`)
        .run();
    }
    if (settings) {
      await DB.prepare("INSERT INTO user_settings (user_id, data, updated_at) VALUES (?, ?, 0)")
        .bind(id, JSON.stringify(settings))
        .run();
    }
  }
  return { DB, ADMIN_DB };
};

const countUsage = (db, day, event, dimension, count) =>
  db
    .prepare("INSERT INTO usage_daily (day, event, dimension, count) VALUES (?, ?, ?, ?)")
    .bind(day, event, dimension, count)
    .run();

describe("preferenceStats", () => {
  test("counts each account's sign-in methods once, email for those with none", async () => {
    const env = await createEnv([
      { providers: ["google"], passkey: true },
      { providers: ["google", "github"] },
      {},
    ]);
    const { accounts, groups } = await preferenceStats(env, NOW);
    expect(accounts).toBe(3);
    expect(groups.signIn).toEqual({
      unit: "users",
      rows: [
        { value: "google", count: 2 },
        { value: "email", count: 1 },
        { value: "github", count: 1 },
        { value: "passkey", count: 1 },
      ],
    });
  });

  test("counts the settings' options, the defaults for those not set", async () => {
    const env = await createEnv([
      {
        settings: {
          distanceUnit: { unit: "imperial" },
          mapsApp: { app: "osm" },
          car: { connectors: ["ccs", "type2"], autoFilter: true },
          filters: { connectorTypes: ["ccs"], onlyFavorites: true, priceLevels: ["1"] },
        },
      },
      { settings: { distanceUnit: { unit: null }, filters: { connectorTypes: ["ccs", "ccs"] } } },
    ]);
    const { groups } = await preferenceStats(env, NOW);
    expect(groups.distanceUnit.rows).toEqual([
      { value: "auto", count: 1 },
      { value: "imperial", count: 1 },
    ]);
    expect(groups.mapsApp.rows).toEqual([
      { value: "ask", count: 1 },
      { value: "osm", count: 1 },
    ]);
    expect(groups.carConnectors.rows).toEqual([
      { value: "ccs", count: 1 },
      { value: "type2", count: 1 },
    ]);
    // A user's value counts once, however often it's in their list.
    expect(groups.filterConnectorTypes.rows).toEqual([{ value: "ccs", count: 2 }]);
    expect(groups.filterOnlyFavorites.rows).toEqual([
      { value: "false", count: 1 },
      { value: "true", count: 1 },
    ]);
    expect(groups.features.rows).toEqual([{ value: "car", count: 1 }]);
  });

  test("lists a route or destination only when enough accounts have it", async () => {
    const commuter = { routeHistory: { routes: [route("Budapest", "Vienna")] } };
    const env = await createEnv([
      { settings: commuter },
      { settings: commuter },
      { settings: { favoriteRoutes: { routes: [route("Budapest", "Vienna")] } } },
      { settings: { routeHistory: { routes: [route("Home", "My aunt's")] } } },
    ]);
    const { groups } = await preferenceStats(env, NOW);
    expect(groups.popularRoutes.rows).toEqual([{ value: "Budapest → Vienna", count: 3 }]);
    expect(groups.popularDestinations.rows).toEqual([{ value: "Vienna", count: 3 }]);
    expect(groups.features.rows).toEqual([
      { value: "routeHistory", count: 3 },
      { value: "favoriteRoutes", count: 1 },
    ]);
  });

  test("counts the device's settings by page view, over the last 30 days", async () => {
    const env = await createEnv([]);
    await countUsage(env.ADMIN_DB, "2026-11-26", "page_view", "en:home", 5);
    await countUsage(env.ADMIN_DB, "2026-11-26", "page_view", "en:country", 2);
    await countUsage(env.ADMIN_DB, "2026-11-20", "page_view", "hu:home", 3);
    await countUsage(env.ADMIN_DB, "2026-01-01", "page_view", "pl:home", 9);
    await countUsage(env.ADMIN_DB, "2026-11-26", "preference", "theme:dark", 4);
    await countUsage(env.ADMIN_DB, "2026-11-26", "preference", "animations:reduced", 1);
    const { groups, pageViewDays } = await preferenceStats(env, NOW);
    expect(pageViewDays).toBe(30);
    expect(groups.language).toEqual({
      unit: "pageViews",
      rows: [
        { value: "en", count: 7 },
        { value: "hu", count: 3 },
      ],
    });
    expect(groups.theme.rows).toEqual([{ value: "dark", count: 4 }]);
    expect(groups.animations.rows).toEqual([{ value: "reduced", count: 1 }]);
  });
});

test("the API is only for admins", () => {
  expect(routes).toEqual([
    expect.objectContaining({ name: "admin-preferences", signedIn: true, admin: true }),
  ]);
});
