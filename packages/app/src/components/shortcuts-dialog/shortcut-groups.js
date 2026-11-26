// The keyboard shortcuts (GoogleMap.js and ShortcutsDialog.js handle them),
// by what they control, as the dialog lists them: each group's title and its
// keys' descriptions in the page's language (`page`, from translations()).
const GROUPS = [
  {
    id: "map",
    keys: [
      ["s", "search"],
      ["l", "locate"],
      ["Esc", "closeDialogs"],
      ["?", "help"],
    ],
  },
  {
    id: "route",
    keys: [
      ["r", "route"],
      ["x", "clearRoute"],
    ],
  },
  {
    id: "filters",
    keys: [
      ["f", "filters"],
      ["c", "clearFilters"],
    ],
  },
  {
    id: "account",
    keys: [
      ["a", "accountMenu"],
      ["h", "favorites"],
      ["n", "suggestCharger"],
      ["p", "savedPlaces"],
    ],
  },
];

export const shortcutGroups = (page) =>
  GROUPS.map(({ id, keys }) => ({
    id,
    title: page.shortcuts.groups[id],
    keys: keys.map(([key, message]) => ({ key, description: page.shortcuts[message] })),
  }));
