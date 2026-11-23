import { describe, expect, test } from "bun:test";
import { priciness, pricinessAmong, pricePerKwh } from "./priciness.js";

describe("pricePerKwh", () => {
  // Cost texts as the sources write them (from the exported chargers).
  test.each([
    ["£0.79/kWh; other tariffs available", 0.79, "GBP"],
    ["0,25€/kWh Münzeinwurf", 0.25, "EUR"],
    ["0,59 €/kWh Gleichstromaufladen", 0.59, "EUR"],
    ["Parkgebühren 15€ / Tag + 0.39€ / kWh", 0.39, "EUR"],
    ["€1.73 + €0.3213/kWh; Andere Tarife möglich", 0.3213, "EUR"],
    ["0,29 Euro/ kWh (incl BTW)", 0.29, "EUR"],
    ["Szolgáltatás díja (bruttó): 80Ft/kWh", 80, "HUF"],
    ["bruttó 80 Ft/kWh", 80, "HUF"],
    ["99,- Ft/kWh", 99, "HUF"],
    ["1.19 PLN/kWh", 1.19, "PLN"],
    ["PLN 1.89/kWh;PLN 0.40/min overstay after 45mins ", 1.89, "PLN"],
    ["1,6 zł/kWh DC, 1,15 zł/kWh AC", 1.6, "PLN"],
    ["$0.30 per Kwh, plus a $5 per hour idle fee", 0.3, "$"],
    ["AUD 0.45 per kWh", 0.45, "AUD"],
    ["0.45/kWh", 0.45, null],
  ])("%p is %p %p", (cost, price, currency) => {
    expect(pricePerKwh(cost)).toEqual({ price, currency });
  });

  test("reads hundredths as such", () => {
    expect(pricePerKwh("45c/kWh +5c/min ab 3h")).toEqual({ price: 0.45, currency: null });
    expect(pricePerKwh("41ct/kWh plus 2.6€ per hour")).toEqual({ price: 0.41, currency: null });
    expect(pricePerKwh("AC 15cnt/kWh + 200cnt/h")).toEqual({ price: 0.15, currency: null });
    expect(pricePerKwh("35p/kWh")).toEqual({ price: 0.35, currency: "GBP" });
    // A currency before the number says it isn't pence.
    expect(pricePerKwh("£0.30p per kWh")).toEqual({ price: 0.3, currency: "GBP" });
  });

  test("is null without a per-kWh price", () => {
    for (const cost of [
      undefined,
      "",
      "0",
      "Free for our clients",
      "AC=0,29, DC=0,49 €",
      "1.50€/hr subscribers",
      "2,52 PLN / 1kW",
      "Consumption-based by kWh",
      "0,- Ft/kWh",
    ]) {
      expect(pricePerKwh(cost)).toBeNull();
    }
  });
});

describe("priciness", () => {
  const at = (usageCost) => ({ usageCost });
  const chargers = ["0,30 €/kWh", "0,40 €/kWh", "0,50 €/kWh", "free"].map(at);

  test("places a price among the others by thirds", () => {
    expect(priciness(at("0,50 €/kWh"), chargers)).toEqual({
      level: 3,
      cheaper: 2 / 3,
      pricier: 0,
    });
    expect(priciness(at("0,40 €/kWh"), chargers)).toEqual({
      level: 2,
      cheaper: 1 / 3,
      pricier: 1 / 3,
    });
    expect(priciness(at("0,30 €/kWh"), chargers)).toEqual({
      level: 1,
      cheaper: 0,
      pricier: 2 / 3,
    });
  });

  test("says how many are cheaper and how many pricier, equal ones neither", () => {
    // One cheaper, one the same, seven pricier: cheaper than 70% of them, not 10%.
    const ten = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 0.3].map((price) =>
      at(`${price} €/kWh`)
    );
    expect(priciness(at("0.3 €/kWh"), ten)).toEqual({ level: 1, cheaper: 0.1, pricier: 0.7 });
  });

  test("compares only prices in the same currency, or an unsaid one", () => {
    // A route from Germany into Poland: złoty aren't compared with euros.
    const route = ["0,30 €/kWh", "0,50 €/kWh", "1.19 PLN/kWh", "2.49 PLN/kWh"].map(at);
    expect(priciness(at("2.49 PLN/kWh"), route)).toEqual({ level: 2, cheaper: 1 / 2, pricier: 0 });
    // "45c" says no currency, so it's compared with every price (as 0.45).
    expect(priciness(at("45c/kWh"), [...chargers, at("45c/kWh")])).toEqual({
      level: 2,
      cheaper: 2 / 4,
      pricier: 1 / 4,
    });
  });

  test("is null with nothing to compare", () => {
    expect(priciness(at("free"), chargers)).toBeNull();
    expect(priciness(at("0,30 €/kWh"), [at("0,30 €/kWh")])).toBeNull();
    expect(priciness(at("1.19 PLN/kWh"), chargers)).toBeNull();
  });

  test("answers about many chargers quickly, reading them once", () => {
    const many = Array.from({ length: 4000 }, (_, index) =>
      at(`${(index % 90) / 100 + 0.1} €/kWh`)
    );
    const of = pricinessAmong(many);
    const start = performance.now();
    for (const charger of many) {
      of(charger);
    }
    expect(performance.now() - start).toBeLessThan(500);
  });
});
