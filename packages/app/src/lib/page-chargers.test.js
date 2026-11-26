import { describe, expect, test } from "bun:test";
import { chargerBounds, spreadChargers } from "./page-chargers.js";

const at = (id, lat, lng, maxPowerKw) => ({ id, location: { lat, lng }, maxPowerKw });

describe("spreadChargers", () => {
  test("keeps the fastest charger of each area, at most as many as asked", () => {
    const chargers = [
      at("slow-a", 52.1, 21.0, 22),
      at("fast-a", 52.1001, 21.0001, 150),
      at("b", 50.06, 19.94, 50),
      at("c", 51.11, 17.03, 350),
      at("d", 54.35, 18.65, 50),
    ];
    const kept = spreadChargers(chargers, 4);
    expect(kept.length).toBeLessThanOrEqual(4);
    expect(kept.map(({ id }) => id)).toContain("fast-a");
    expect(kept.map(({ id }) => id)).not.toContain("slow-a");
  });

  test("coarsens the grid until few enough are left, still spread over the country", () => {
    // A 20 × 20 grid of chargers, 0.1° apart.
    const chargers = Array.from({ length: 400 }, (_, index) =>
      at(`${index}`, 49 + Math.floor(index / 20) / 10, 14 + (index % 20) / 10, index % 7)
    );
    const kept = spreadChargers(chargers, 20);
    expect(kept.length).toBeLessThanOrEqual(20);
    expect(kept.length).toBeGreaterThan(5);
    const lats = kept.map(({ location }) => location.lat);
    expect(Math.max(...lats) - Math.min(...lats)).toBeGreaterThan(1);
  });
});

describe("chargerBounds", () => {
  test("covers the chargers, leaving out a few far-off ones", () => {
    const chargers = [
      ...Array.from({ length: 198 }, (_, index) =>
        at(`${index}`, 46 + (index % 3), 17 + (index % 5), 50)
      ),
      at("misplaced-north", 89, 0, 50),
      at("misplaced-west", 47, -170, 50),
    ];
    const bounds = chargerBounds(chargers);
    expect(bounds.north).toBe(48);
    expect(bounds.south).toBe(46);
    expect(bounds.west).toBe(17);
    expect(bounds.east).toBe(21);
  });
});
