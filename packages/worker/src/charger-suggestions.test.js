import { describe, expect, test } from "bun:test";
import {
  adminSuggestionsResponse,
  suggestionsResponse,
  validSuggestion,
} from "./charger-suggestions.js";
import { chargersInBounds, toClientCharger } from "./db.js";
import { testD1 } from "./test-d1.js";

const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const SUGGESTION = {
  name: "Harbor Charging Hub",
  address: "10 Dock Rd",
  operator: "Ionity",
  location: { lat: 47.5, lng: 19.05 },
  connectors: [
    { type: "ccs2", powerKw: 350, quantity: 4 },
    { type: "type2", powerKw: 22, quantity: 2 },
  ],
  photo: PHOTO,
};

const createDb = () =>
  testD1(
    "../migrations/0001_chargers.sql",
    "../migrations/0008_charger_suggestions.sql",
    "../migrations/0009_charger_suggestions_photos.sql",
    "../migrations/0002_auth.sql",
    "../migrations/0005_favorites.sql",
    "../migrations/0010_charger_reports.sql"
  );

describe("validSuggestion", () => {
  test("accepts a location with multiple chargers of different speeds and a proof photo", () => {
    expect(validSuggestion(SUGGESTION)).toBe(true);
  });

  test("accepts multiple photos up to 2 MB each and rejects oversized photos", () => {
    expect(validSuggestion({ ...SUGGESTION, photos: [PHOTO, PHOTO] })).toBe(true);
    expect(
      validSuggestion({ ...SUGGESTION, photos: [PHOTO, PHOTO, PHOTO, PHOTO, PHOTO, PHOTO] })
    ).toBe(false);
    const over2Mb = `data:image/png;base64,${"A".repeat(2 * 1024 * 1024 * 2)}`;
    expect(validSuggestion({ ...SUGGESTION, photos: [over2Mb] })).toBe(false);
  });

  test("turns down missing name, location, connectors or proof photo", () => {
    expect(validSuggestion({ ...SUGGESTION, name: "   " })).toBe(false);
    expect(validSuggestion({ ...SUGGESTION, location: { lat: 95, lng: 0 } })).toBe(false);
    expect(validSuggestion({ ...SUGGESTION, connectors: [] })).toBe(false);
    expect(
      validSuggestion({
        ...SUGGESTION,
        connectors: [{ type: "ccs2", powerKw: 0, quantity: 1 }],
      })
    ).toBe(false);
    expect(validSuggestion({ ...SUGGESTION, photo: "not-a-photo" })).toBe(false);
  });
});

describe("charger suggestions flow", () => {
  test("submits a suggestion, lists it for admins, and adds it to chargers on approval", async () => {
    const db = createDb();
    const env = { DB: db, ADMIN_EMAIL_DOMAIN: "chealt.com" };

    const submit = await suggestionsResponse(
      new Request("https://ev.chealt.com/api/charger-suggestions", {
        method: "POST",
        body: JSON.stringify(SUGGESTION),
      }),
      env,
      "user-1",
      { email: "ada@example.com" }
    );
    expect(submit.status).toBe(201);

    const listUrl = new URL("https://ev.chealt.com/api/admin/charger-suggestions?status=pending");
    const listed = await (
      await adminSuggestionsResponse(new Request(listUrl), env, listUrl)
    ).json();
    expect(listed.suggestions).toHaveLength(1);
    expect(listed.suggestions[0]).toMatchObject({
      id: 1,
      userEmail: "ada@example.com",
      name: "Harbor Charging Hub",
      operator: "Ionity",
      status: "pending",
      photoUrl: "/api/charger-suggestions/1/photo?index=0",
      photoUrls: ["/api/charger-suggestions/1/photo?index=0"],
      connectors: SUGGESTION.connectors,
    });
    expect(listed.suggestions[0].photo).toBeUndefined();

    const approveUrl = new URL("https://ev.chealt.com/api/admin/charger-suggestions/1/approve");
    const approved = await adminSuggestionsResponse(
      new Request(approveUrl, { method: "POST" }),
      env,
      approveUrl
    );
    expect(approved.status).toBe(200);

    // Now in the database and spatial index, with maxPowerKw 350 and 6 points,
    // and no photo is exposed on the public charger record.
    const { rows } = await chargersInBounds(db, { north: 48, south: 47, east: 20, west: 19 }, 10);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: "community",
      source_id: "1",
      name: "Harbor Charging Hub",
      operator: "Ionity",
      number_of_points: 6,
      max_power_kw: 350,
    });
  });

  test("takes the availability and price with proof, scores it, and the approved charger shows them", async () => {
    const db = createDb();
    const env = { DB: db, ADMIN_EMAIL_DOMAIN: "chealt.com" };
    expect(validSuggestion({ ...SUGGESTION, price: { free: true } })).toBe(false);

    const submit = await suggestionsResponse(
      new Request("https://ev.chealt.com/api/charger-suggestions", {
        method: "POST",
        body: JSON.stringify({
          ...SUGGESTION,
          availability: "partly-operational",
          price: { free: true },
          receiptPhotos: [PHOTO],
          deviceLocation: { lat: 47.5, lng: 19.05, accuracy: 8 },
        }),
      }),
      env,
      "user-1",
      { email: "ada@example.com" }
    );
    expect(submit.status).toBe(201);

    const listUrl = new URL("https://ev.chealt.com/api/admin/charger-suggestions");
    const listed = await (
      await adminSuggestionsResponse(new Request(listUrl), env, listUrl)
    ).json();
    expect(listed.suggestions[0]).toMatchObject({
      availability: "partly-operational",
      price: { free: true },
      receiptPhotoUrls: ["/api/charger-suggestions/1/photo?index=1"],
      deviceLocation: { lat: 47.5, lng: 19.05, accuracy: 8 },
      distanceM: 0,
      // At the charger, with a charger and a receipt photo.
      trustScore: 60,
    });

    const approveUrl = new URL("https://ev.chealt.com/api/admin/charger-suggestions/1/approve");
    await adminSuggestionsResponse(new Request(approveUrl, { method: "POST" }), env, approveUrl);
    const { rows } = await chargersInBounds(db, { north: 48, south: 47, east: 20, west: 19 }, 10);
    expect(toClientCharger(rows[0])).toMatchObject({ status: "partly-operational", free: true });
  });

  test("scopes suggestions and proof photos strictly to the submitting user and admins", async () => {
    const db = createDb();
    const env = { DB: db, ADMIN_EMAIL_DOMAIN: "chealt.com" };
    await suggestionsResponse(
      new Request("https://ev.chealt.com/api/charger-suggestions", {
        method: "POST",
        body: JSON.stringify(SUGGESTION),
      }),
      env,
      "user-1",
      { email: "ada@example.com" }
    );

    // The submitting user sees their own suggestion and can filter by status.
    const user1List = await (
      await suggestionsResponse(
        new Request("https://ev.chealt.com/api/charger-suggestions?status=pending"),
        env,
        "user-1",
        { email: "ada@example.com" }
      )
    ).json();
    expect(user1List.suggestions).toHaveLength(1);
    expect(user1List.suggestions[0]).toMatchObject({
      id: 1,
      name: "Harbor Charging Hub",
      status: "pending",
      photoUrl: "/api/charger-suggestions/1/photo?index=0",
      photoUrls: ["/api/charger-suggestions/1/photo?index=0"],
    });

    // Another signed-in user does not see user-1's suggestion.
    const user2List = await (
      await suggestionsResponse(
        new Request("https://ev.chealt.com/api/charger-suggestions"),
        env,
        "user-2",
        { email: "bob@example.com" }
      )
    ).json();
    expect(user2List.suggestions).toEqual([]);

    // The submitting user and an admin can fetch the proof photo; another
    // user gets 404.
    const photoReq = new Request("https://ev.chealt.com/api/charger-suggestions/1/photo");
    const ownerPhoto = await suggestionsResponse(photoReq, env, "user-1", {
      email: "ada@example.com",
    });
    expect(ownerPhoto.status).toBe(200);
    expect(ownerPhoto.headers.get("content-type")).toBe("image/png");
    expect(ownerPhoto.headers.get("cache-control")).toBe("private, no-store");

    const otherUserPhoto = await suggestionsResponse(photoReq, env, "user-2", {
      email: "bob@example.com",
    });
    expect(otherUserPhoto.status).toBe(404);

    const adminPhoto = await suggestionsResponse(photoReq, env, "admin-1", {
      email: "grace@chealt.com",
    });
    expect(adminPhoto.status).toBe(200);
  });

  test("rejects a suggestion without adding it to chargers", async () => {
    const db = createDb();
    const env = { DB: db, ADMIN_EMAIL_DOMAIN: "chealt.com" };
    await suggestionsResponse(
      new Request("https://ev.chealt.com/api/charger-suggestions", {
        method: "POST",
        body: JSON.stringify(SUGGESTION),
      }),
      env,
      "user-1",
      { email: "ada@example.com" }
    );

    const rejectUrl = new URL("https://ev.chealt.com/api/admin/charger-suggestions/1/reject");
    const rejected = await adminSuggestionsResponse(
      new Request(rejectUrl, { method: "POST" }),
      env,
      rejectUrl
    );
    expect(rejected.status).toBe(200);

    const { rows } = await chargersInBounds(db, { north: 48, south: 47, east: 20, west: 19 }, 10);
    expect(rows).toHaveLength(0);
  });
});
