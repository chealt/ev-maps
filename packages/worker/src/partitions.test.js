import { describe, expect, test } from "bun:test";
import { PARTS, partOf, splitByPart } from "./partitions.js";

describe("partitions", () => {
  test("puts an ID in the same part every time", () => {
    expect(partOf("irve:FRS35PSD5B0")).toBe(partOf("irve:FRS35PSD5B0"));
    expect(partOf("eipa:95424")).toBeGreaterThanOrEqual(0);
    expect(partOf("eipa:95424")).toBeLessThan(PARTS);
  });

  test("spreads many IDs fairly evenly", () => {
    const counts = Array(PARTS).fill(0);
    for (let index = 0; index < 16000; index++) {
      counts[partOf(`irve:FR${index}`)]++;
    }
    expect(Math.min(...counts)).toBeGreaterThan(800);
    expect(Math.max(...counts)).toBeLessThan(1200);
  });

  test("splits values by their ID's part", () => {
    const parts = splitByPart({ "eipa:1": [1, 0, 0, 1], "eipa:2": [0, 1, 0, 1] });
    expect(parts).toHaveLength(PARTS);
    expect(parts[partOf("eipa:1")]["eipa:1"]).toEqual([1, 0, 0, 1]);
    expect(parts.flatMap((part) => Object.keys(part)).sort()).toEqual(["eipa:1", "eipa:2"]);
  });
});

describe("isDue", () => {
  test("refreshes a 5-minute source every time, a 15-minute one every third", async () => {
    const { isDue } = await import("./live-status.js");
    const at = (minute) => Date.UTC(2026, 10, 21, 14, minute, 3);
    expect([0, 5, 10, 15].map((minute) => isDue({ everyMinutes: 5 }, at(minute)))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect([0, 5, 10, 15, 30].map((minute) => isDue({ everyMinutes: 15 }, at(minute)))).toEqual([
      true,
      false,
      false,
      true,
      true,
    ]);
  });
});
