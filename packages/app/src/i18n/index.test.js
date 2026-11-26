import { expect, test } from "bun:test";

// index.js checks the translations as it loads, as the build does: every
// key English has, capitalized where English is.
test("the translations are complete and capitalized like English", async () => {
  const { translations } = await import("./index.js");
  expect(translations("hu").page.clearRouteShort).toBe("Törlése");
});
