import { describe, expect, test } from "bun:test";
import { adminReportsResponse, reportsResponse, validReport } from "./charger-reports.js";
import { chargersInBounds, toClientCharger, upsertChargers } from "./db.js";
import { testD1 } from "./test-d1.js";

const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const NOW = Date.UTC(2026, 10, 1);

// At the charger (47.5, 19.05): about 30 m away, sure of its position.
const REPORT = {
  chargerId: "ocm:42",
  availability: "temporarily-unavailable",
  price: { amount: 0.45, currency: "EUR", unit: "kwh" },
  deviceLocation: { lat: 47.50027, lng: 19.05, accuracy: 12 },
  chargerPhotos: [PHOTO],
  receiptPhotos: [PHOTO],
};

const createDb = async () => {
  const db = testD1(
    "../migrations/0001_chargers.sql",
    "../migrations/0002_auth.sql",
    "../migrations/0005_favorites.sql",
    "../migrations/0008_charger_suggestions.sql",
    "../migrations/0009_charger_suggestions_photos.sql",
    "../migrations/0010_charger_reports.sql"
  );
  await upsertChargers(
    db,
    [
      {
        source: "ocm",
        sourceId: "42",
        name: "Harbor Charging Hub",
        lat: 47.5,
        lng: 19.05,
        usageCost: "€0.39/kWh",
        status: "Operational",
        connectors: [],
      },
    ],
    NOW
  );
  return db;
};

const submit = (env, payload, userId = "user-1") =>
  reportsResponse(
    new Request("https://ev.chealt.com/api/charger-reports", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
    env,
    userId,
    { email: "ada@example.com" }
  );

const admin = (env, path, method = "GET") => {
  const url = new URL(`https://ev.chealt.com${path}`);
  return adminReportsResponse(new Request(url, { method }), env, url);
};

describe("validReport", () => {
  test("takes the availability, the price, or both, with the device's location and a charger photo", () => {
    expect(validReport(REPORT)).toBe(true);
    expect(validReport({ ...REPORT, price: undefined, receiptPhotos: undefined })).toBe(true);
    expect(validReport({ ...REPORT, availability: undefined })).toBe(true);
    expect(validReport({ ...REPORT, price: { free: true } })).toBe(true);
  });

  test("turns down a report without a change, without proof, or with values it doesn't know", () => {
    expect(validReport({ ...REPORT, availability: undefined, price: undefined })).toBe(false);
    expect(validReport({ ...REPORT, deviceLocation: undefined })).toBe(false);
    expect(validReport({ ...REPORT, chargerPhotos: [] })).toBe(false);
    // A price needs a receipt's (or an invoice's, or an app's) photo.
    expect(validReport({ ...REPORT, receiptPhotos: [] })).toBe(false);
    expect(validReport({ ...REPORT, availability: "haunted" })).toBe(false);
    expect(validReport({ ...REPORT, price: { amount: 0.45, currency: "XXX", unit: "kwh" } })).toBe(
      false
    );
    expect(validReport({ ...REPORT, chargerId: "no-source" })).toBe(false);
  });
});

describe("charger reports flow", () => {
  test("scores a report, lists it for admins, and on approval the charger shows it, past imports", async () => {
    const db = await createDb();
    const env = { DB: db, ADMIN_EMAIL_DOMAIN: "chealt.com" };

    const submitted = await submit(env, REPORT);
    expect(submitted.status).toBe(201);

    const { reports } = await (
      await admin(env, "/api/admin/charger-reports?status=pending")
    ).json();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      id: 1,
      userEmail: "ada@example.com",
      chargerId: "ocm:42",
      chargerName: "Harbor Charging Hub",
      currentStatus: "operational",
      currentCost: "€0.39/kWh",
      availability: "temporarily-unavailable",
      price: { amount: 0.45, currency: "EUR", unit: "kwh" },
      distanceM: 30,
      // At the charger with both photos, from a new account.
      trustScore: 60,
      photos: [
        { kind: "charger", url: "/api/charger-reports/1/photos/0" },
        { kind: "receipt", url: "/api/charger-reports/1/photos/1" },
      ],
      status: "pending",
    });

    expect((await admin(env, "/api/admin/charger-reports/1/approve", "POST")).status).toBe(200);
    // The next import doesn't undo it.
    await upsertChargers(
      db,
      [
        {
          source: "ocm",
          sourceId: "42",
          name: "Harbor Charging Hub",
          lat: 47.5,
          lng: 19.05,
          usageCost: "€0.39/kWh",
          status: "Operational",
          connectors: [],
        },
      ],
      NOW + 1
    );
    const { rows } = await chargersInBounds(db, { north: 48, south: 47, east: 20, west: 19 }, 10);
    expect(toClientCharger(rows[0])).toMatchObject({
      status: "temporarily-unavailable",
      usageCost: "EUR 0.45/kWh",
    });
    expect((await admin(env, "/api/admin/charger-reports/1/approve", "POST")).status).toBe(409);
  });

  test("an approved report counts for the user's next one; a rejected one, against it", async () => {
    const db = await createDb();
    const env = { DB: db, ADMIN_EMAIL_DOMAIN: "chealt.com" };
    const onlyAvailability = { ...REPORT, price: undefined, receiptPhotos: undefined };

    await submit(env, onlyAvailability);
    await admin(env, "/api/admin/charger-reports/1/approve", "POST");
    await submit(env, onlyAvailability);
    await submit(env, onlyAvailability, "user-2");
    await admin(env, "/api/admin/charger-reports/3/reject", "POST");
    await submit(env, onlyAvailability, "user-2");

    const { reports } = await (await admin(env, "/api/admin/charger-reports")).json();
    // Newest first: user-2's after a rejection, user-2's first, user-1's
    // after an approval, user-1's first.
    expect(reports.map(({ trustScore }) => trustScore)).toEqual([35, 45, 50, 45]);
    expect(reports.map(({ status }) => status)).toEqual([
      "pending",
      "rejected",
      "pending",
      "approved",
    ]);
  });

  test("shows a report's photos only to its author and admins, and needs a known charger", async () => {
    const db = await createDb();
    const env = { DB: db, ADMIN_EMAIL_DOMAIN: "chealt.com" };
    await submit(env, REPORT);
    const photo = (userId, email) =>
      reportsResponse(
        new Request("https://ev.chealt.com/api/charger-reports/1/photos/1"),
        env,
        userId,
        { email, emailVerified: true }
      );
    expect((await photo("user-1", "ada@example.com")).status).toBe(200);
    expect((await photo("user-1", "ada@example.com")).headers.get("content-type")).toBe(
      "image/png"
    );
    expect((await photo("user-2", "eve@example.com")).status).toBe(404);
    expect((await photo("admin", "admin@chealt.com")).status).toBe(200);

    expect((await submit(env, { ...REPORT, chargerId: "ocm:404" })).status).toBe(404);
  });
});
