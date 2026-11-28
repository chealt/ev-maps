// The admin area's navigation: groups of sections, each a page at
// /{lang}/admin/{path}/ with an icon (a lucide-static name) and a label from the translations. A
// section can have sub-pages (`children`, the navigation's second level),
// at /{lang}/admin/{path}/{child path}/. A new admin section adds its page
// and one line here, in its group, which keeps its sections sorted.
const ADMIN_GROUPS = [
  {
    id: "community",
    label: "adminGroupCommunity",
    sections: [
      {
        id: "charger-reports",
        path: "charger-reports",
        label: "adminChargerReports",
        icon: "Flag",
      },
      { id: "suggestions", path: "suggestions", label: "adminSuggestions", icon: "MapPinPlus" },
      {
        id: "unavailability",
        path: "unavailability",
        label: "adminUnavailability",
        icon: "Ban",
      },
    ],
  },
  {
    id: "insights",
    label: "adminGroupInsights",
    sections: [
      { id: "performance", path: "performance", label: "adminPerformance", icon: "Gauge" },
      { id: "sponsors", path: "sponsors", label: "adminSponsors", icon: "HandHeart" },
      {
        id: "usage",
        path: "usage",
        label: "adminUsage",
        icon: "ChartColumn",
        children: [
          { id: "activity", path: "", label: "adminUsageActivity" },
          { id: "settings", path: "settings", label: "adminUsageSettings" },
          { id: "filters", path: "filters", label: "adminUsageFilters" },
          { id: "routes", path: "routes", label: "adminUsageRoutes" },
        ],
      },
    ],
  },
  {
    id: "engineering",
    label: "adminGroupEngineering",
    sections: [
      { id: "errors", path: "errors", label: "adminErrors", icon: "Bug" },
      { id: "reports", path: "reports", label: "adminReports", icon: "FlaskConical" },
    ],
  },
];

// Every section, in the navigation's order.
const ADMIN_SECTIONS = ADMIN_GROUPS.flatMap(({ sections }) => sections);

export { ADMIN_GROUPS, ADMIN_SECTIONS };
