import { afterAll, describe, expect, test } from "bun:test";
import { map } from "./pl/map.js";

// The page's language and its messages, as Layout.astro bakes them in.
globalThis.document = {
  documentElement: { lang: "pl" },
  getElementById: () => ({ textContent: JSON.stringify({ messages: map.messages }) }),
};
const { message } = await import("../lib/messages.js");

afterAll(() => {
  delete globalThis.document;
});

describe("message's plural forms", () => {
  test("picks Polish's form for each count", () => {
    expect(message("chargersFound", { count: 1 })).toBe("Znaleziono 1 stację ładowania");
    expect(message("chargersFound", { count: 3 })).toBe("Znaleziono 3 stacje ładowania");
    expect(message("chargersFound", { count: 5 })).toBe("Znaleziono 5 stacji ładowania");
    expect(message("chargersFound", { count: 22 })).toBe("Znaleziono 22 stacje ładowania");
  });
});
