import { describe, expect, test } from "bun:test";
import { compare, sortValue } from "./sort-value.js";

const cell = (text, sort) => ({ textContent: text, dataset: sort === undefined ? {} : { sort } });

describe("sortValue", () => {
  test("is a cell's data-sort, or its text", () => {
    expect(sortValue(cell("1.2 s", "1200"))).toBe(1200);
    expect(sortValue(cell("  GET /api  "))).toBe("GET /api");
  });

  test("reads numbers with separators or a unit after them", () => {
    expect(sortValue(cell("1,234"))).toBe(1234);
    expect(sortValue(cell("12 345"))).toBe(12345);
    expect(sortValue(cell("12 ms"))).toBe(12);
    expect(sortValue(cell("-3"))).toBe(-3);
  });

  test("keeps text that only has numbers in it", () => {
    expect(sortValue(cell("Page 2"))).toBe("Page 2");
  });
});

describe("compare", () => {
  test("sorts numbers as numbers, and text with its digits as numbers", () => {
    expect([10, 9, 100].sort(compare)).toEqual([9, 10, 100]);
    expect(["b", "A", "item 10", "item 9"].sort(compare)).toEqual(["A", "b", "item 9", "item 10"]);
  });
});
