import { describe, expect, test } from "bun:test";
import { distanceMeters, trustScore } from "./trust-score.js";

const NOW = Date.UTC(2026, 10, 1);
const DAY = 24 * 60 * 60 * 1000;
const NEW_USER = { history: { approved: 0, rejected: 0 }, usage: { sessions: 1, favorites: 0 } };
const FULL_PROOF = { distanceM: 40, accuracyM: 10, chargerPhotos: 1, receiptPhotos: 1 };

const points = ({ factors }) => Object.fromEntries(factors.map(({ id, points }) => [id, points]));

describe("trustScore", () => {
  test("a new user's full proof: their device at the charger, and both photos", () => {
    const trust = trustScore(FULL_PROOF, NEW_USER.history, NEW_USER.usage, NOW);
    expect(trust.score).toBe(60);
    expect(points(trust)).toEqual({
      location: 30,
      chargerPhoto: 15,
      receiptPhoto: 15,
      approvedBefore: 0,
      rejectedBefore: 0,
      accountAge: 0,
      signIns: 0,
      favorites: 0,
    });
  });

  test("trusts a device less the farther it was, and less still when unsure of its position", () => {
    const score = (distanceM, accuracyM) =>
      points(trustScore({ distanceM, accuracyM }, NEW_USER.history, NEW_USER.usage, NOW)).location;
    expect(score(150, 10)).toBe(30);
    expect(score(900, 10)).toBe(15);
    expect(score(5000, 10)).toBe(0);
    expect(score(40, 500)).toBe(15);
    expect(score(undefined, undefined)).toBe(0);
  });

  test("counts a loyal user's history and usage, within 0-100", () => {
    const loyal = trustScore(
      FULL_PROOF,
      { approved: 10, rejected: 0 },
      { accountCreatedAt: NOW - 400 * DAY, sessions: 12, favorites: 3 },
      NOW
    );
    expect(points(loyal)).toMatchObject({
      approvedBefore: 20,
      accountAge: 10,
      signIns: 5,
      favorites: 5,
    });
    expect(loyal.score).toBe(100);

    const rejectedOften = trustScore(
      { chargerPhotos: 1 },
      { approved: 0, rejected: 5 },
      NEW_USER.usage,
      NOW
    );
    expect(points(rejectedOften).rejectedBefore).toBe(-30);
    expect(rejectedOften.score).toBe(0);
  });
});

describe("distanceMeters", () => {
  test("measures along the Earth's surface", () => {
    // About 111 km for a degree of latitude.
    expect(Math.round(distanceMeters({ lat: 47, lng: 19 }, { lat: 48, lng: 19 }) / 1000)).toBe(111);
    expect(distanceMeters({ lat: 47.5, lng: 19.05 }, { lat: 47.5, lng: 19.05 })).toBe(0);
  });
});
