import { describe, expect, test } from "bun:test";
import { adminFlagsResponse, flagsResponse, validFlag } from "./charger-unavailability.js";
import { chargersInBounds, toClientCharger, upsertChargers } from "./db.js";
import { testD1 } from "./test-d1.js";

const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const charger = (sourceId, name, lat) => ({
  source: "ocm",
  sourceId,
  name,
  lat,
  lng: 19.05,
  status: "Operational",
  connectors: [],
});

const createDb = async () => {
  const db = testD1(
    "../migrations/0001_chargers.sql",
    "../migrations/0002_auth.sql",
    "../migrations/0005_favorites.sql",
    "../migrations/0008_charger_suggestions.sql",
    "../migrations/0009_charger_suggestions_photos.sql",
    "../migrations/0010_charger_reports.sql",
    "../migrations/0011_charger_unavailability.sql"
  );
  await upsertChargers(
    db,
    [charger("1", "Harbor Hub", 47.5), charger("2", "Station Square", 47.6)],
    Date.UTC(2026, 10, 1)
  );
  return { DB: db, ADMIN_EMAIL_DOMAIN: "chealt.com" };
};

const flag = (env, payload, userId = "user-1", email = "ada@example.com") =>
  flagsResponse(
    new Request("https://ev.chealt.com/api/charger-unavailability", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
    env,
    userId,
    { email }
  );

const admin = (env, path, method = "GET") => {
  const url = new URL(`https://ev.chealt.com${path}`);
  return adminFlagsResponse(new Request(url, { method }), env, url);
};

describe("validFlag", () => {
  test("takes a charger, with or without one photo", () => {
    expect(validFlag({ chargerId: "ocm:1" })).toBe(true);
    expect(validFlag({ chargerId: "ocm:1", photo: PHOTO })).toBe(true);
    expect(validFlag({ chargerId: "1" })).toBe(false);
    expect(validFlag({ chargerId: "ocm:1", photo: "data:text/plain;base64,aGk=" })).toBe(false);
    expect(validFlag({ chargerId: "ocm:1", photo: [PHOTO] })).toBe(false);
  });
});

describe("unavailability flags", () => {
  test("lists the chargers by how many people flagged them, then by photos", async () => {
    const env = await createDb();
    // Harbor Hub: two people, no photo. Station Square: two people, one
    // photo, so it comes first; its photo flag before the other.
    await flag(env, { chargerId: "ocm:1" });
    await flag(env, { chargerId: "ocm:1" }, "user-2", "bob@example.com");
    await flag(env, { chargerId: "ocm:2", photo: PHOTO }, "user-3", "cy@example.com");
    await flag(env, { chargerId: "ocm:2" }, "user-4", "di@example.com");

    const { chargers } = await (await admin(env, "/api/admin/charger-unavailability")).json();
    expect(
      chargers.map(({ chargerName, reporters, withPhoto }) => [chargerName, reporters, withPhoto])
    ).toEqual([
      ["Station Square", 2, 1],
      ["Harbor Hub", 2, 0],
    ]);
    expect(chargers[0]).toMatchObject({ chargerId: "ocm:2", currentStatus: "operational" });
    expect(chargers[0].flags.map(({ userEmail, photoUrl }) => [userEmail, photoUrl])).toEqual([
      ["cy@example.com", "/api/charger-unavailability/3/photo"],
      ["di@example.com", null],
    ]);
  });

  test("counts a person once per charger, keeping their photo", async () => {
    const env = await createDb();
    await flag(env, { chargerId: "ocm:1", photo: PHOTO });
    expect((await flag(env, { chargerId: "ocm:1" })).status).toBe(201);

    const { chargers } = await (await admin(env, "/api/admin/charger-unavailability")).json();
    expect(chargers).toHaveLength(1);
    expect(chargers[0]).toMatchObject({ reporters: 1, withPhoto: 1 });
  });

  test("confirming marks the charger temporarily unavailable; dismissing only closes the flags", async () => {
    const env = await createDb();
    await flag(env, { chargerId: "ocm:1" });
    await flag(env, { chargerId: "ocm:1" }, "user-2");
    await flag(env, { chargerId: "ocm:2" });

    const confirmed = await admin(env, "/api/admin/charger-unavailability/ocm%3A1/confirm", "POST");
    expect(await confirmed.json()).toEqual({ chargerId: "ocm:1", status: "confirmed", flags: 2 });
    expect(
      (await admin(env, "/api/admin/charger-unavailability/ocm%3A2/dismiss", "POST")).status
    ).toBe(200);
    expect(
      (await admin(env, "/api/admin/charger-unavailability/ocm%3A2/dismiss", "POST")).status
    ).toBe(404);

    const { rows } = await chargersInBounds(
      env.DB,
      { north: 48, south: 47, east: 20, west: 19 },
      10
    );
    const statuses = Object.fromEntries(
      rows.map((row) => [toClientCharger(row).name, toClientCharger(row).status])
    );
    expect(statuses).toEqual({
      "Harbor Hub": "temporarily-unavailable",
      "Station Square": "operational",
    });
    const { chargers } = await (await admin(env, "/api/admin/charger-unavailability")).json();
    expect(chargers).toEqual([]);
    // Closed, a person can flag it again.
    await flag(env, { chargerId: "ocm:2" });
    expect(
      (await (await admin(env, "/api/admin/charger-unavailability")).json()).chargers
    ).toHaveLength(1);
  });

  test("shows a flag's photo only to its author and admins, and needs a known charger", async () => {
    const env = await createDb();
    await flag(env, { chargerId: "ocm:1", photo: PHOTO });
    const photo = (userId, email) =>
      flagsResponse(
        new Request("https://ev.chealt.com/api/charger-unavailability/1/photo"),
        env,
        userId,
        { email, emailVerified: true }
      );
    expect((await photo("user-1", "ada@example.com")).headers.get("content-type")).toBe(
      "image/png"
    );
    expect((await photo("user-2", "eve@example.com")).status).toBe(404);
    expect((await photo("admin", "admin@chealt.com")).status).toBe(200);
    expect((await flag(env, { chargerId: "ocm:404" })).status).toBe(404);
  });
});
