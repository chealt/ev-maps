import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import mapping from "../e2e-domains.json" with { type: "json" };
import { grepOf, selectE2e } from "./e2e-selection.js";

const specs = [];
const walk = (url) => {
  for (const entry of readdirSync(url, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      walk(new URL(`${entry.name}/`, url));
    } else if (entry.name.endsWith(".spec.js")) {
      specs.push(entry.name.slice(0, -".spec.js".length));
    }
  }
};
walk(new URL("../src/", import.meta.url));
walk(new URL("../../admin/components/", import.meta.url));

describe("selectE2e", () => {
  test("runs a domain's specs when its files change", () => {
    expect(
      selectE2e(["packages/app/src/components/favorites-dialog/FavoritesDialog.js"], mapping)
    ).toEqual({ all: false, tests: ["favorites"], domains: ["favorites"] });
  });

  test("joins the specs of every domain touched", () => {
    const selection = selectE2e(
      [
        "packages/app/src/components/route-planner/RoutePlanner.js",
        "packages/app/src/components/shortcuts-dialog/ShortcutsDialog.js",
      ],
      mapping
    );
    expect(selection.tests).toEqual([
      "favorite-routes",
      "navigate",
      "place-search",
      "route-planner",
      "saved-places",
      "shortcuts",
    ]);
  });

  test("runs a changed spec, even one no domain lists yet", () => {
    expect(
      selectE2e(
        [
          "packages/app/src/components/favorites-dialog/favorites.spec.js",
          "packages/app/src/components/google-map/brand-new.spec.js",
        ],
        mapping
      )
    ).toEqual({ all: false, tests: ["brand-new", "favorites"], domains: [] });
  });

  test("runs everything for shared files, and app files no domain lists", () => {
    expect(selectE2e(["bun.lock"], mapping)).toMatchObject({ all: true });
    expect(selectE2e(["packages/e2e/fixtures/auth-api.js"], mapping)).toMatchObject({
      all: true,
    });
    expect(selectE2e(["packages/app/src/lib/something-new.js"], mapping)).toEqual({
      all: true,
      reason: "packages/app/src/lib/something-new.js",
    });
  });

  test("runs only the regression tests for changes outside the app", () => {
    expect(selectE2e(["packages/worker/src/tiles.js", "docs/features/map.md"], mapping)).toEqual({
      all: false,
      tests: [],
      domains: [],
    });
  });
});

describe("grepOf", () => {
  test("matches the selected specs' files or the regression tag", () => {
    const grep = new RegExp(grepOf({ all: false, tests: ["favorites", "route-planner"] }));
    expect(grep.test("tests/favorites.spec.js › saves a favorite")).toBe(true);
    expect(grep.test("tests/route-planner.spec.js › plans")).toBe(true);
    expect(grep.test("tests/google-map.spec.js › shows the markers @regression")).toBe(true);
    expect(grep.test("tests/google-map.spec.js › shows the markers")).toBe(false);
  });

  test("is empty, so everything runs, when everything is selected", () => {
    expect(grepOf({ all: true })).toBe("");
  });
});

describe("e2e-domains.json", () => {
  test("names only specs that exist, and every spec is in a domain", () => {
    const named = Object.values(mapping.domains).flatMap((domain) => domain.tests);
    expect(named.filter((name) => !specs.includes(name))).toEqual([]);
    expect(specs.filter((name) => !named.includes(name))).toEqual([]);
  });
});
