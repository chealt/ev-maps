import { describe, expect, test } from "bun:test";
import {
  formatDays,
  formatHourRanges,
  formatPrice,
  percentFromUsual,
  weekdayName,
} from "./price-history.js";

describe("price history formatting", () => {
  test("formats a price with its unit", () => {
    expect(formatPrice("en", 2.5, "PLN/kWh")).toBe("2.50 PLN/kWh");
    expect(formatPrice("pl", 2.5, "PLN/kWh")).toBe("2,50 PLN/kWh");
  });

  test("formats hour ranges", () => {
    expect(formatHourRanges("en", [{ from: 22, to: 6 }])).toBe("22:00–06:00");
    expect(
      formatHourRanges("en", [
        { from: 1, to: 3 },
        { from: 17, to: 24 },
      ])
    ).toBe("01:00–03:00 and 17:00–00:00");
  });

  test("names weekdays from Monday", () => {
    expect(weekdayName("en", 0)).toBe("Monday");
    expect(formatDays("en", [5, 6])).toBe("Saturday and Sunday");
  });

  test("says how far the price is from the usual", () => {
    expect(percentFromUsual({ current: 3, usual: 2.5 })).toBe(20);
    expect(percentFromUsual({ current: 2, usual: 2.5 })).toBe(20);
  });
});
