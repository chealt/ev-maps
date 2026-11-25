import { describe, expect, test } from "bun:test";
import { ChargerIndex } from "./charger-index.js";

// The filtering rules, without the page: the end-to-end filter specs only
// check that the dialog's choices reach the map (power-filter.spec.js,
// connector-filter.spec.js, operator-filter.spec.js).
const charger = (id, { kw = 50, connectors = ["ccs2"], operator, usageCost, amenities } = {}) => ({
  id,
  location: { lat: 47 + id.length / 100, lng: 19 },
  maxPowerKw: kw,
  connectors: connectors.map((type) => ({ type, powerKw: kw ?? 0, quantity: 1 })),
  operator,
  usageCost,
  amenities,
});

const RANGES = {
  slow: { minKw: 0, maxKw: 50 },
  fast: { minKw: 50, maxKw: 150 },
  rapid: { minKw: 150, maxKw: 300 },
  ultra: { minKw: 300, maxKw: Infinity },
};

const NO_FILTERS = {
  ranges: [],
  connectorTypes: [],
  excludedOperators: [],
  favoriteIds: null,
  unavailableIds: [],
  amenities: [],
  priceLevels: [],
};

const matching = (chargers, filters) => {
  const index = new ChargerIndex();
  index.setChargers(chargers);
  return index.filter({ ...NO_FILTERS, ...filters }).matching.sort();
};

describe("ChargerIndex.filter: power", () => {
  const chargers = [
    charger("slow", { kw: 22 }),
    charger("fast", { kw: 100 }),
    charger("boundary", { kw: 150 }),
    charger("ultra", { kw: 350 }),
    charger("unknown", { kw: null }),
  ];

  test("with no range on, every charger, even without power data", () => {
    expect(matching(chargers, {})).toHaveLength(5);
  });

  test("only the chargers in the ranges on, which add up", () => {
    expect(matching(chargers, { ranges: [RANGES.slow] })).toEqual(["slow"]);
    expect(matching(chargers, { ranges: [RANGES.rapid, RANGES.ultra] })).toEqual([
      "boundary",
      "ultra",
    ]);
  });

  test("a charger on a range's boundary is in the higher range", () => {
    expect(matching(chargers, { ranges: [RANGES.fast] })).toEqual(["fast"]);
    expect(matching(chargers, { ranges: [RANGES.rapid] })).toEqual(["boundary"]);
  });
});

describe("ChargerIndex.filter: connectors", () => {
  const chargers = [
    charger("ccs", { kw: 150, connectors: ["ccs2"] }),
    charger("chademo", { kw: 50, connectors: ["chademo"] }),
    charger("mall", { kw: 22, connectors: ["type2-socket", "ccs2"] }),
    charger("none", { connectors: [] }),
  ];

  test("chargers with a connector of any of the types on", () => {
    expect(matching(chargers, { connectorTypes: ["ccs2"] })).toEqual(["ccs", "mall"]);
    expect(matching(chargers, { connectorTypes: ["chademo", "type2-socket"] })).toEqual([
      "chademo",
      "mall",
    ]);
  });

  test("and in the power ranges on too", () => {
    expect(
      matching(chargers, { connectorTypes: ["chademo", "type2-socket"], ranges: [RANGES.slow] })
    ).toEqual(["mall"]);
  });
});

describe("ChargerIndex.filter: operators", () => {
  const chargers = [
    charger("ionity-1", { operator: "Ionity" }),
    charger("ionity-2", { operator: " Ionity " }),
    charger("tesla", { operator: "Tesla", connectors: ["chademo"] }),
    charger("mystery"),
  ];

  test("hides the operators turned off, the unknown one by an empty name", () => {
    expect(matching(chargers, { excludedOperators: ["Ionity", ""] })).toEqual(["tesla"]);
  });

  test("lists as available what every filter but the operators' leaves", () => {
    const index = new ChargerIndex();
    index.setChargers(chargers);
    const { matching: shown, available } = index.filter({
      ...NO_FILTERS,
      connectorTypes: ["ccs2"],
      excludedOperators: ["Ionity"],
    });
    expect(shown).toEqual(["mystery"]);
    expect(available.sort()).toEqual(["ionity-1", "ionity-2", "mystery"]);
  });
});

describe("ChargerIndex.filter: the other filters", () => {
  test("only favorites, when asked", () => {
    const chargers = [charger("a"), charger("b")];
    expect(matching(chargers, { favoriteIds: ["b"] })).toEqual(["b"]);
    expect(matching(chargers, { favoriteIds: [] })).toEqual([]);
  });

  test("hides the unavailable ones", () => {
    expect(matching([charger("a"), charger("b")], { unavailableIds: ["a"] })).toEqual(["b"]);
  });

  test("only chargers with every place asked for nearby", () => {
    const chargers = [
      charger("both", { amenities: ["coffee", "toilets"] }),
      charger("coffee", { amenities: ["coffee"] }),
      charger("unknown"),
    ];
    expect(matching(chargers, { amenities: ["coffee", "toilets"] })).toEqual(["both"]);
  });

  test("only chargers at the price levels on; those without a comparable price at none", () => {
    const chargers = [
      charger("cheap", { usageCost: "0,30 €/kWh" }),
      charger("mid", { usageCost: "0,40 €/kWh" }),
      charger("pricey", { usageCost: "0,50 €/kWh" }),
      charger("unpriced", { usageCost: "parking fee applies" }),
    ];
    expect(matching(chargers, { priceLevels: [1] })).toEqual(["cheap"]);
    expect(matching(chargers, { priceLevels: [1, 3] })).toEqual(["cheap", "pricey"]);
  });
});
