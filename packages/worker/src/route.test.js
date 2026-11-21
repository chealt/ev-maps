import { describe, expect, test } from "bun:test";
import { cumulativeMeters, nearestOnRoute, routeChunks } from "./route.js";

// Budapest to Vienna in two straight lines, through Győr: about 218 km.
const budapest = { lat: 47.4979, lng: 19.0402 };
const gyor = { lat: 47.6875, lng: 17.6504 };
const vienna = { lat: 48.2082, lng: 16.3738 };
const route = [budapest, gyor, vienna];

const corridorMeters = 5000;
const cumulative = cumulativeMeters(route);
const chunks = routeChunks(route, corridorMeters, cumulative);

describe("cumulativeMeters", () => {
  test("measures the distance from the start to every point", () => {
    expect(cumulative[0]).toBe(0);
    // Straight lines: Budapest–Győr is about 106 km, Győr–Vienna about 111 km.
    expect(cumulative[1] / 1000).toBeGreaterThan(104);
    expect(cumulative[1] / 1000).toBeLessThan(109);
    expect(cumulative[2] / 1000).toBeGreaterThan(212);
    expect(cumulative[2] / 1000).toBeLessThan(222);
  });
});

describe("routeChunks", () => {
  test("covers every segment exactly once, in order", () => {
    expect(chunks[0].from).toBe(0);
    expect(chunks.at(-1).to).toBe(route.length - 1);
    for (let index = 1; index < chunks.length; index++) {
      expect(chunks[index].from).toBe(chunks[index - 1].to);
    }
  });

  test("splits a long, finely drawn route into chunks of about 20 km", () => {
    const fine = Array.from({ length: 101 }, (_, index) => ({
      lat: budapest.lat + ((vienna.lat - budapest.lat) * index) / 100,
      lng: budapest.lng + ((vienna.lng - budapest.lng) * index) / 100,
    }));
    const fineChunks = routeChunks(fine, corridorMeters);
    expect(fineChunks.length).toBeGreaterThanOrEqual(9);
    expect(fineChunks.length).toBeLessThanOrEqual(12);
  });

  test("grows each chunk's bounds by the corridor", () => {
    const { north, south } = chunks[0].bounds;
    expect(north).toBeGreaterThan(gyor.lat + 0.04);
    expect(south).toBeLessThan(budapest.lat - 0.04);
  });
});

describe("nearestOnRoute", () => {
  test("finds a point on the route at no distance, along the way", () => {
    const halfway = { lat: (budapest.lat + gyor.lat) / 2, lng: (budapest.lng + gyor.lng) / 2 };
    const { fromRoute, along } = nearestOnRoute(route, cumulative, halfway, chunks);
    expect(fromRoute).toBeLessThan(1);
    expect(along / 1000).toBeCloseTo(cumulative[1] / 2000, 0);
  });

  test("measures how far a point is off the route", () => {
    // 3 km north of Győr.
    const offRoute = { lat: gyor.lat + 3000 / 111320, lng: gyor.lng };
    const { fromRoute, along } = nearestOnRoute(route, cumulative, offRoute, chunks);
    expect(fromRoute / 1000).toBeGreaterThan(1.5);
    expect(fromRoute / 1000).toBeLessThan(3.1);
    expect(along / 1000).toBeCloseTo(cumulative[1] / 1000, -1);
  });

  test("leaves points outside the corridor far away", () => {
    const prague = { lat: 50.0755, lng: 14.4378 };
    expect(nearestOnRoute(route, cumulative, prague, chunks).fromRoute).toBe(Infinity);
  });

  test("handles a route that doubles back on itself", () => {
    const outAndBack = [budapest, gyor, budapest];
    const back = cumulativeMeters(outAndBack);
    const { along } = nearestOnRoute(
      outAndBack,
      back,
      budapest,
      routeChunks(outAndBack, corridorMeters, back)
    );
    // The start is the closest point; ties keep the first.
    expect(along).toBe(0);
  });
});
