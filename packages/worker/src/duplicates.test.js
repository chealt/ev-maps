import { describe, expect, test } from "bun:test";
import { mergeDuplicates } from "./duplicates.js";

// About 1 m of latitude, in degrees.
const METER = 1 / 111320;
const at = (metersNorth) => ({ lat: 52.2118 + metersNorth * METER, lng: 20.9502 });

const charger = (overrides) => ({
  id: `${overrides.source}:1`,
  name: undefined,
  address: "",
  maxPowerKw: null,
  connectors: [],
  location: at(0),
  ...overrides,
});

describe("mergeDuplicates", () => {
  test("merges records of the same charger from different sources", () => {
    const osm = charger({
      id: "osm:way/1",
      source: "osm",
      name: "EKOEN CH Reduta",
      operator: "EKOEN",
      numberOfPoints: 6,
    });
    const ocm = charger({
      id: "ocm:2",
      source: "ocm",
      location: at(30),
      address: "Aleja Jerozolimskie 148, Warszawa",
      maxPowerKw: 350,
      connectors: [{ type: "ccs2", powerKw: 350, quantity: 6 }],
    });

    const [merged, ...rest] = mergeDuplicates([osm, ocm]);

    expect(rest).toHaveLength(0);
    // Open Charge Map ranks first, so its record leads…
    expect(merged.id).toBe("ocm:2");
    expect(merged.location).toEqual(ocm.location);
    expect(merged.sources).toEqual(["ocm", "osm"]);
    expect(merged.ids).toEqual(["ocm:2", "osm:way/1"]);
    // …and fields it lacks come from OpenStreetMap.
    expect(merged.name).toBe("EKOEN CH Reduta");
    expect(merged.operator).toBe("EKOEN");
    expect(merged.numberOfPoints).toBe(6);
    expect(merged.address).toBe("Aleja Jerozolimskie 148, Warszawa");
    expect(merged.maxPowerKw).toBe(350);
    expect(merged.connectors).toEqual(ocm.connectors);
  });

  test("takes the connectors from the record that has their power", () => {
    const ocm = charger({ source: "ocm", connectors: [{ type: "type2", quantity: 2 }] });
    const osm = charger({
      source: "osm",
      location: at(10),
      maxPowerKw: 22,
      connectors: [{ type: "type2", powerKw: 22, quantity: 2 }],
    });

    const [merged] = mergeDuplicates([ocm, osm]);

    expect(merged.connectors).toEqual(osm.connectors);
    expect(merged.maxPowerKw).toBe(22);
  });

  test("never merges records from the same source", () => {
    const first = charger({ id: "osm:1", source: "osm" });
    const second = charger({ id: "osm:2", source: "osm", location: at(5) });

    expect(mergeDuplicates([first, second])).toHaveLength(2);
  });

  test("keeps records farther apart than 60 m separate", () => {
    const ocm = charger({ source: "ocm" });
    const osm = charger({ source: "osm", location: at(80) });

    expect(mergeDuplicates([ocm, osm])).toHaveLength(2);
  });

  test("joins each record to the nearest charger from its other sources", () => {
    const ocmNorth = charger({ id: "ocm:north", source: "ocm", location: at(50) });
    const ocmSouth = charger({ id: "ocm:south", source: "ocm", location: at(0) });
    const osm = charger({ id: "osm:near-south", source: "osm", location: at(10) });

    const merged = mergeDuplicates([ocmNorth, ocmSouth, osm]);

    expect(merged).toHaveLength(2);
    expect(merged.find((group) => group.id === "ocm:south").sources).toEqual(["ocm", "osm"]);
    expect(merged.find((group) => group.id === "ocm:north").sources).toBeUndefined();
  });

  test("keeps extra fields of the leading record, e.g. its place on a route", () => {
    const route = { distanceFromStartMeters: 1000, distanceFromRouteMeters: 20 };
    const ocm = charger({ source: "ocm", route });
    const osm = charger({ source: "osm", location: at(5), route: { ...route, bogus: true } });

    expect(mergeDuplicates([ocm, osm])[0].route).toEqual(route);
  });

  test("leaves a charger only one source has unchanged", () => {
    const only = charger({ source: "osm", name: "Solo" });

    expect(mergeDuplicates([only])).toEqual([only]);
  });
});

test("ranks Poland's register first", () => {
  const ocm = charger({ id: "ocm:1", source: "ocm", name: "From OCM", maxPowerKw: 50 });
  const eipa = charger({ id: "eipa:2", source: "eipa", location: at(20), name: "From EIPA" });

  const [merged] = mergeDuplicates([ocm, eipa]);

  expect(merged.id).toBe("eipa:2");
  expect(merged.name).toBe("From EIPA");
  // EIPA has no power here, so it comes from Open Charge Map.
  expect(merged.maxPowerKw).toBe(50);
});
