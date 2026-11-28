import { describe, expect, test } from "bun:test";
import {
  chargerParam,
  cleanUpPrices,
  eipaPrices,
  hourRanges,
  hourlyPrices,
  isHourStart,
  listAdminPrices,
  priceHistory,
  pricePattern,
  pricesResponse,
  recordPrices,
} from "./charger-prices.js";
import { upsertChargers } from "./db.js";
import { testD1 } from "./test-d1.js";

const HOUR = 60 * 60 * 1000;
// Monday 2026-11-02 00:00 in Warsaw (UTC+1).
const MONDAY = Date.UTC(2026, 10, 1, 23);

const createDb = () =>
  testD1("../migrations/0001_chargers.sql", "../migrations/0014_charger_prices.sql");

describe("eipaPrices", () => {
  test("takes each pool's cheapest price per kWh", () => {
    const data = [
      { point_id: 1, prices: [{ price: "2.89", unit: "kWh" }] },
      {
        point_id: 2,
        prices: [
          { price: "2.49", unit: "kWh" },
          { price: "0.5", unit: "min" },
        ],
      },
      { point_id: 3, prices: [{ price: "1.99", unit: "kWh" }] },
      { point_id: 4, prices: [{ price: "abc", unit: "kWh" }] },
      { point_id: 9, prices: [{ price: "1.00", unit: "kWh" }] },
    ];
    expect(eipaPrices(data, { 1: 10, 2: 10, 3: 11, 4: 12 })).toEqual({
      "eipa:10": 2.49,
      "eipa:11": 1.99,
    });
  });
});

describe("isHourStart", () => {
  test("is the first five minutes of an hour", () => {
    expect(isHourStart(Date.UTC(2026, 10, 1, 10, 0))).toBe(true);
    expect(isHourStart(Date.UTC(2026, 10, 1, 10, 5))).toBe(false);
    expect(isHourStart(undefined)).toBe(false);
  });
});

describe("recordPrices", () => {
  test("stores only changes, and a null for a price gone", async () => {
    const db = createDb();
    expect(await recordPrices(db, "eipa", { "eipa:1": 2, "eipa:2": 3 }, MONDAY)).toBe(2);
    expect(await recordPrices(db, "eipa", { "eipa:1": 2, "eipa:2": 3 }, MONDAY + HOUR)).toBe(0);
    expect(await recordPrices(db, "eipa", { "eipa:1": 2.5 }, MONDAY + 2 * HOUR)).toBe(2);
    expect(
      db.sqlite.query("SELECT * FROM charger_prices ORDER BY recorded_at, charger_id").all()
    ).toEqual([
      { charger_id: "eipa:1", recorded_at: MONDAY, price: 2 },
      { charger_id: "eipa:2", recorded_at: MONDAY, price: 3 },
      { charger_id: "eipa:1", recorded_at: MONDAY + 2 * HOUR, price: 2.5 },
      { charger_id: "eipa:2", recorded_at: MONDAY + 2 * HOUR, price: null },
    ]);
    expect(await recordPrices(db, "eipa", { "eipa:1": 2.5 }, MONDAY + 3 * HOUR)).toBe(0);
    expect(db.sqlite.query("SELECT recorded_at FROM charger_price_runs").get()).toEqual({
      recorded_at: MONDAY + 3 * HOUR,
    });
  });

  test("cleans up old changes but keeps each charger's latest", async () => {
    const db = createDb();
    const old = MONDAY - 100 * 24 * HOUR;
    await recordPrices(db, "eipa", { "eipa:1": 2, "eipa:2": 3 }, old);
    await recordPrices(db, "eipa", { "eipa:1": 2.5, "eipa:2": 3 }, old + HOUR);
    await cleanUpPrices(db, MONDAY);
    expect(
      db.sqlite.query("SELECT charger_id, price FROM charger_prices ORDER BY charger_id").all()
    ).toEqual([
      { charger_id: "eipa:1", price: 2.5 },
      { charger_id: "eipa:2", price: 3 },
    ]);
  });
});

describe("hourlyPrices", () => {
  test("expands changes to one price per hour", () => {
    const changes = [
      { recorded_at: 2 * HOUR, price: 3 },
      { recorded_at: 4 * HOUR, price: null },
    ];
    expect(hourlyPrices(changes, { price: 1 }, HOUR, 5 * HOUR)).toEqual([1, 3, 3, null, null]);
    expect(hourlyPrices(changes, null, HOUR, 3 * HOUR)).toEqual([null, 3, 3]);
  });
});

describe("hourRanges", () => {
  test("joins hours, across midnight too", () => {
    const levels = Array.from({ length: 24 }, (_, hour) =>
      hour >= 22 || hour < 6 ? "lower" : hour >= 17 && hour < 19 ? "higher" : "usual"
    );
    expect(hourRanges(levels, "lower")).toEqual([{ from: 22, to: 6 }]);
    expect(hourRanges(levels, "higher")).toEqual([{ from: 17, to: 19 }]);
  });
});

// A week, hourly: 2 at night (22-6 Warsaw), 3 in the evening (17-19),
// otherwise 2.5, and 3 all Sunday.
const week = () =>
  Array.from({ length: 7 * 24 }, (_, index) => {
    const hour = index % 24;
    if (index >= 6 * 24) {
      return 3;
    }
    if (hour >= 22 || hour < 6) {
      return 2;
    }
    return hour >= 17 && hour < 19 ? 3 : 2.5;
  });

describe("pricePattern", () => {
  test("finds the cheap and pricey hours and days, in the source's time zone", () => {
    const pattern = pricePattern(week(), MONDAY, "Europe/Warsaw");
    expect(pattern.cheapHours).toEqual([{ from: 22, to: 6 }]);
    expect(pattern.expensiveHours).toEqual([{ from: 17, to: 19 }]);
    expect(pattern.expensiveDays).toEqual([6]);
    expect(pattern.cheapDays).toEqual([]);
    expect(pattern.min).toBe(2);
    expect(pattern.max).toBe(3);
    expect(pattern.current).toBe(3);
    expect(pattern.currentLevel).toBe("higher");
    expect(pattern.byHour).toHaveLength(24);
  });

  test("a steady price has no highlights", () => {
    const pattern = pricePattern(Array(100).fill(2), MONDAY, "Europe/Warsaw");
    expect(pattern.usual).toBe(2);
    expect(pattern.currentLevel).toBe("usual");
    expect(pattern.cheapHours).toEqual([]);
    expect(pattern.expensiveDays).toEqual([]);
  });

  test("needs a few days for a pattern, and a price at all", () => {
    expect(pricePattern(Array(10).fill(2), MONDAY, "Europe/Warsaw").byHour).toBeNull();
    expect(pricePattern([null, null], MONDAY, "Europe/Warsaw")).toBeNull();
  });
});

describe("priceHistory and the API", () => {
  const seed = async () => {
    const db = createDb();
    const hours = week();
    for (const [index, price] of hours.entries()) {
      await recordPrices(db, "eipa", { "eipa:1": price }, MONDAY + index * HOUR);
    }
    return db;
  };

  test("gives the last days hourly with the pattern", async () => {
    const db = await seed();
    const now = MONDAY + 7 * 24 * HOUR;
    const history = await priceHistory(db, "eipa:1", now);
    expect(history.from).toBe(MONDAY);
    expect(history.hours).toEqual(week());
    expect(history.unit).toBe("PLN/kWh");
    expect(history.cheapHours).toEqual([{ from: 22, to: 6 }]);
    expect(await priceHistory(db, "eipa:2", now)).toBeNull();
    expect(await priceHistory(db, "ocm:1", now)).toBeNull();
  });

  test("answers the first ID with a history", async () => {
    const db = await seed();
    const response = await pricesResponse(
      new Request("https://ev.chealt.com/api/chargers/prices?ids=ocm:5,eipa:1"),
      { DB: db }
    );
    const { history } = await response.json();
    expect(history.id).toBe("eipa:1");
    const none = await pricesResponse(
      new Request("https://ev.chealt.com/api/chargers/prices?ids=ocm:5"),
      { DB: db }
    );
    expect((await none.json()).history).toBeNull();
  });

  test("lists the admins' summary and latest changes", async () => {
    const db = await seed();
    await upsertChargers(
      db,
      [{ source: "eipa", sourceId: "1", name: "Rondo", lat: 52, lng: 21, connectors: [] }],
      MONDAY
    );
    const data = await listAdminPrices(db, "eipa:1", MONDAY + 7 * 24 * HOUR);
    expect(data.tracked).toBe(1);
    expect(data.runs).toEqual([
      { source: "eipa", unit: "PLN/kWh", recordedAt: MONDAY + (7 * 24 - 1) * HOUR },
    ]);
    expect(data.recent[0]).toMatchObject({ chargerId: "eipa:1", chargerName: "Rondo", price: 3 });
    expect(data.charger.id).toBe("eipa:1");
  });

  test("takes only a charger ID as ?charger=", () => {
    expect(chargerParam(new URL("https://x/?charger=eipa:1"))).toBe("eipa:1");
    expect(chargerParam(new URL("https://x/?charger=nope"))).toBeNull();
    expect(chargerParam(new URL("https://x/"))).toBeNull();
  });
});
