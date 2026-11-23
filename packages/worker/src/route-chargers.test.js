import { describe, expect, test } from "bun:test";
import { upsertChargers } from "./db.js";
import { chargersAlongRoute } from "./route-chargers.js";
import { cumulativeMeters } from "./route.js";
import { testD1 } from "./test-d1.js";

// The chargers database, with D1's batch().
const chargersDb = () => {
  const db = testD1("../migrations/0001_chargers.sql", "../migrations/0006_charger_amenities.sql");
  // As D1 answers: each statement's { results }.
  return { ...db, batch: async (statements) => Promise.all(statements.map((s) => s.all())) };
};

const charger = (sourceId, lat, lng) => ({
  source: "ocm",
  sourceId,
  country: "HU",
  name: `Charger ${sourceId}`,
  lat,
  lng,
  address: "",
  connectors: [],
});

// A straight route east along the equator, ~44.5 km: 0.1° is ~11.1 km.
const path = [0, 0.1, 0.2, 0.3, 0.4].map((lng) => ({ lat: 0, lng }));
const ROUTE_METERS = cumulativeMeters(path).at(-1);

describe("chargersAlongRoute", () => {
  test("says how far each charger is from the start, to the end and off the route", async () => {
    const db = chargersDb();
    // 1/4 of the way along, ~1.1 km north of it; and 3/4 of the way, on it.
    await upsertChargers(db, [charger("1", 0.01, 0.1), charger("2", 0, 0.3)], Date.now());

    const { chargers } = await chargersAlongRoute(db, { path, corridorMeters: 5000 });

    expect(chargers.map(({ name, route }) => [name, route])).toEqual([
      [
        "Charger 1",
        {
          distanceFromStartMeters: Math.round(ROUTE_METERS / 4),
          distanceToEndMeters: Math.round((ROUTE_METERS * 3) / 4),
          distanceFromRouteMeters: 1113,
        },
      ],
      [
        "Charger 2",
        {
          distanceFromStartMeters: Math.round((ROUTE_METERS * 3) / 4),
          distanceToEndMeters: Math.round(ROUTE_METERS / 4),
          distanceFromRouteMeters: 0,
        },
      ],
    ]);
  });

  test("leaves out chargers outside the corridor", async () => {
    const db = chargersDb();
    await upsertChargers(db, [charger("1", 0.2, 0.2)], Date.now());
    expect((await chargersAlongRoute(db, { path, corridorMeters: 5000 })).chargers).toEqual([]);
  });
});
