import { describe, expect, test } from "bun:test";
import {
  adminSuggestionsResponse,
  suggestionsResponse,
  validSuggestion,
} from "./charger-suggestions.js";
import { chargersInBounds } from "./db.js";
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
  testD1("../migrations/0001_chargers.sql", "../migrations/0008_charger_suggestions.sql");

describe("validSuggestion", () => {
  test("accepts a location with multiple chargers of different speeds and a proof photo", () => {
    expect(validSuggestion(SUGGESTION)).toBe(true);
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
    const env = { DB: db };

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
      connectors: SUGGESTION.connectors,
    });

    const approveUrl = new URL("https://ev.chealt.com/api/admin/charger-suggestions/1/approve");
    const approved = await adminSuggestionsResponse(
      new Request(approveUrl, { method: "POST" }),
      env,
      approveUrl
    );
    expect(approved.status).toBe(200);

    // Now in the database and spatial index, with maxPowerKw 350 and 6 points.
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

  test("rejects a suggestion without adding it to chargers", async () => {
    const db = createDb();
    const env = { DB: db };
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
