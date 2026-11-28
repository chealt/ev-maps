import { describe, expect, test } from "bun:test";
import { chargerName } from "./charger-name.js";

// A charger with neither a name nor an operator is named in the page's
// language; the Polish page shows that (languages.spec.js).
describe("chargerName", () => {
  test("is the charger's name", () => {
    expect(chargerName({ name: "Downtown Supercharger", operator: "Tesla" })).toBe(
      "Downtown Supercharger"
    );
  });

  test("is the operator for a charger without a name", () => {
    expect(chargerName({ operator: "Tesla" })).toBe("Tesla");
    expect(chargerName({ name: "", operator: "Tesla" })).toBe("Tesla");
  });
});
