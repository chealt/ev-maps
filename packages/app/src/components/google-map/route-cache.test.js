import { describe, expect, test } from "bun:test";
import { ROUTE_MAX_AGE_MS, ROUTE_REFRESH_MS, planState, samePlan } from "./route-cache.js";

const now = 1_800_000_000_000;
const plan = (overrides = {}) => ({
  path: [
    { lat: 47.5, lng: 19.04 },
    { lat: 48.2, lng: 16.37 },
  ],
  stopDistances: [215000],
  chargers: [{ id: "ocm:1" }, { id: "ocm:2" }],
  full: false,
  plannedAt: now,
  ...overrides,
});

describe("planState", () => {
  test("shows a just planned route as it is", () => {
    expect(planState(plan(), now)).toBe("fresh");
    expect(planState(plan({ plannedAt: now - ROUTE_REFRESH_MS + 1 }), now)).toBe("fresh");
  });

  test("shows an older one, planning it again in the background", () => {
    expect(planState(plan({ plannedAt: now - ROUTE_REFRESH_MS }), now)).toBe("stale");
    expect(planState(plan({ plannedAt: now - ROUTE_MAX_AGE_MS + 1 }), now)).toBe("stale");
  });

  test("plans again first when it's too old, from the future, or not a plan", () => {
    expect(planState(plan({ plannedAt: now - ROUTE_MAX_AGE_MS }), now)).toBe("expired");
    expect(planState(plan({ plannedAt: now + 1000 }), now)).toBe("expired");
    expect(planState(undefined, now)).toBe("expired");
    expect(planState(plan({ path: [] }), now)).toBe("expired");
    expect(planState(plan({ path: [{ lat: "x" }] }), now)).toBe("expired");
    expect(planState(plan({ chargers: null }), now)).toBe("expired");
  });
});

describe("samePlan", () => {
  test("is the same when nothing shown differs, whenever it was planned", () => {
    expect(samePlan(plan(), plan({ plannedAt: now + 5000 }))).toBe(true);
  });

  test("differs with another path, other legs or other chargers", () => {
    expect(samePlan(plan(), plan({ path: [{ lat: 47.5, lng: 19.04 }] }))).toBe(false);
    expect(samePlan(plan(), plan({ stopDistances: [216000] }))).toBe(false);
    expect(samePlan(plan(), plan({ chargers: [{ id: "ocm:1" }] }))).toBe(false);
    expect(samePlan(plan(), plan({ full: true }))).toBe(false);
  });
});
