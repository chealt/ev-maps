import { expect, test } from "bun:test";
import { translations } from "../../i18n/index.js";
import { shortcutGroups } from "./shortcut-groups.js";

test("groups the keys by what they control, each described", () => {
  expect(shortcutGroups(translations("en").page)).toEqual([
    {
      id: "map",
      title: "Map",
      keys: [
        { key: "s", description: "Search for a place" },
        { key: "l", description: "Locate me" },
        { key: "Esc", description: "Close dialogs and the charger details" },
        { key: "?", description: "Show this help" },
      ],
    },
    {
      id: "route",
      title: "Route",
      keys: [
        { key: "r", description: "Plan a route" },
        { key: "x", description: "Clear the route" },
      ],
    },
    {
      id: "filters",
      title: "Filters",
      keys: [
        { key: "f", description: "Show or hide the filters" },
        { key: "c", description: "Clear the filters" },
      ],
    },
    {
      id: "account",
      title: "Account",
      keys: [
        { key: "a", description: "Open or close the account menu" },
        { key: "h", description: "Show your favorites" },
        { key: "n", description: "Suggest a charger" },
        { key: "p", description: "Go to your saved places" },
      ],
    },
  ]);
});

test("titles and describes every key in every language", () => {
  const hungarian = shortcutGroups(translations("hu").page);
  const polish = shortcutGroups(translations("pl").page);
  expect(hungarian.every(({ title }) => typeof title === "string")).toBe(true);
  expect(polish.every(({ title }) => typeof title === "string")).toBe(true);
  expect(
    hungarian
      .flatMap(({ keys }) => keys)
      .every(({ description }) => typeof description === "string")
  ).toBe(true);
  expect(
    polish.flatMap(({ keys }) => keys).every(({ description }) => typeof description === "string")
  ).toBe(true);
});
