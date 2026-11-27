import { connectorGroups } from "./connector-groups.js";

// The admin area's Usage pages (#373), for their L2 navigation: the
// activity (/{lang}/admin/usage/) and what users prefer, one page per
// section (/{lang}/admin/usage/{id}/), each with its groups of the
// preference stats (packages/worker/src/preference-stats.js).
const PREFERENCE_SECTIONS = [
  {
    id: "settings",
    label: "adminUsageSettings",
    groups: [
      "signIn",
      "language",
      "theme",
      "animations",
      "distanceUnit",
      "mapsApp",
      "savedPlacesOnMap",
      "carConnectors",
      "carAutoFilter",
    ],
  },
  {
    id: "filters",
    label: "adminUsageFilters",
    groups: [
      "filterConnectorTypes",
      "filterPowerRanges",
      "filterPriceLevels",
      "filterNearby",
      "filterOnlyFavorites",
      "filterHideUnavailable",
      "filterExcludedOperators",
    ],
  },
  {
    id: "routes",
    label: "adminUsageRoutes",
    groups: ["features", "savedPlaceIcons", "popularDestinations", "popularRoutes"],
  },
];

// The L2 navigation's items, in order.
const usageNavigation = (lang, page) => [
  { id: "activity", href: `/${lang}/admin/usage/`, label: page.adminUsageActivity },
  ...PREFERENCE_SECTIONS.map(({ id, label }) => ({
    id,
    href: `/${lang}/admin/usage/${id}/`,
    label: page[label],
  })),
];

// How each group's values read, from the app's own labels.
const preferenceLabels = (page, values) => {
  const connectors = Object.fromEntries(
    connectorGroups(page).map(({ value, label }) => [value, label])
  );
  const yesNo = { true: page.adminYes, false: page.adminNo };
  return {
    signIn: values.signInMethods,
    theme: page.themes,
    animations: values.animationSettings,
    distanceUnit: page.distanceUnits,
    mapsApp: { ...values.mapsApps, ask: page.adminAskEachTime },
    savedPlacesOnMap: yesNo,
    carConnectors: connectors,
    carAutoFilter: yesNo,
    filterConnectorTypes: connectors,
    filterPowerRanges: {
      "under-50": "< 50 kW",
      "50-150": "50–150 kW",
      "150-300": "150–300 kW",
      "300-plus": "300+ kW",
    },
    filterPriceLevels: page.priceLevels,
    filterNearby: values.amenities,
    filterOnlyFavorites: yesNo,
    filterHideUnavailable: yesNo,
    features: values.preferenceFeatures,
    savedPlaceIcons: values.placeIcons,
  };
};

export { PREFERENCE_SECTIONS, preferenceLabels, usageNavigation };
