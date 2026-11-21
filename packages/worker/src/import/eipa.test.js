import { describe, expect, test } from "bun:test";
import { countEipaStatuses } from "../live-status.js";
import { toChargers } from "./eipa.js";

// A pool with two stations: one electric with two points, one suspended.
const files = {
  pools: [
    {
      id: 95424,
      charging: true,
      name: "EKOEN Reduta,",
      latitude: 52.211808,
      longitude: 20.949948,
      street: "Aleje Jerozolimskie",
      house_number: "148",
      postal_code: "02-326",
      city: "Warszawa",
      operator_id: 7,
    },
    {
      id: 2,
      charging: true,
      name: "No working stations",
      latitude: 50,
      longitude: 20,
      operator_id: 7,
    },
    { id: 3, charging: false, name: "Gas only", latitude: 51, longitude: 21, operator_id: 7 },
  ],
  stations: [
    { id: 10, pool_id: 95424, type: "E", suspended: false },
    { id: 11, pool_id: 95424, type: "E", suspended: true },
    { id: 20, pool_id: 2, type: "E", suspended: true },
    { id: 30, pool_id: 3, type: "G", suspended: false },
  ],
  points: [
    { id: 100, station_id: 10, connectors: [{ interfaces: [29], power: 350 }] },
    {
      id: 101,
      station_id: 10,
      connectors: [
        { interfaces: [29], power: 350 },
        { interfaces: [10], power: 22 },
      ],
    },
    { id: 102, station_id: 11, connectors: [{ interfaces: [11], power: 50 }] },
    { id: 200, station_id: 20, connectors: [{ interfaces: [10], power: 11 }] },
  ],
  operators: [{ id: 7, short_name: "EKOEN", name: "EKOEN sp. z o.o." }],
  dictionary: {
    connector_interface: [
      { id: 10, name: "IEC-62196-T2-F-NOCABLE" },
      { id: 11, name: "CHADEMO" },
      { id: 29, name: "IEC-62196-T2-COMBO" },
    ],
  },
  dynamic: [
    { point_id: 100, prices: [{ price: "2.89", unit: "kWh" }] },
    {
      point_id: 101,
      prices: [
        { price: "2.49", unit: "kWh" },
        { price: "0.5", unit: "min" },
      ],
    },
  ],
};

describe("toChargers", () => {
  const { chargers, pointPools } = toChargers(files);

  test("makes one charger per pool with working electric stations", () => {
    expect(chargers.map((charger) => charger.sourceId)).toEqual(["95424"]);
  });

  test("describes the pool", () => {
    expect(chargers[0]).toMatchObject({
      source: "eipa",
      country: "PL",
      name: "EKOEN Reduta",
      lat: 52.211808,
      lng: 20.949948,
      address: "Aleje Jerozolimskie 148, 02-326 Warszawa",
      operator: "EKOEN",
      numberOfPoints: 2,
      maxPowerKw: 350,
      usageCost: "2.49 PLN/kWh, 0.50 PLN/min",
      license: "EIPA, Urząd Dozoru Technicznego",
    });
  });

  test("counts the same connectors across points", () => {
    expect(chargers[0].connectors).toEqual([
      { type: "IEC-62196-T2-COMBO", powerKw: 350, quantity: 2 },
      { type: "IEC-62196-T2-F-NOCABLE", powerKw: 22, quantity: 1 },
    ]);
  });

  test("drops names that are only the address", () => {
    const named = (name) =>
      toChargers({ ...files, pools: [{ ...files.pools[0], name }] }).chargers[0].name;

    expect(named("Aleje Jerozolimskie 179, 02-222 Warszawa")).toBeNull();
    expect(named("UL. ALEJE JEROZOLIMSKIE 148, 02-326 WARSZAWA, dz.ew. 31")).toBeNull();
    expect(named("Aleje Jerozolimskie 148")).toBeNull();
    expect(named("Galeria G City Reduta, Warszawa")).toBe("Galeria G City Reduta, Warszawa");
  });

  test("maps the working points to their pool, for the statuses", () => {
    expect(pointPools).toEqual({ 100: 95424, 101: 95424 });
  });
});

describe("countEipaStatuses", () => {
  test("counts free, occupied and out-of-service points per charger", () => {
    const statuses = countEipaStatuses(
      [
        { point_id: 1, status: { availability: 1, status: 1 } },
        { point_id: 2, status: { availability: 1, status: 0 } },
        { point_id: 3, status: { availability: 0, status: 1 } },
        { point_id: 4 },
        { point_id: 5, status: { availability: 1, status: 1 } },
        { point_id: 999, status: { availability: 1, status: 1 } },
      ],
      { 1: 95424, 2: 95424, 3: 95424, 4: 95424, 5: 7 }
    );

    // [available, occupied, out of service, total]
    expect(statuses).toEqual({ "eipa:95424": [1, 1, 1, 4], "eipa:7": [1, 0, 0, 1] });
  });
});
