// The admin area's sections, for its navigation: each is a page at
// /{lang}/admin/{path}/ with a label from the translations. A new admin
// section adds its page and one line here.
const ADMIN_SECTIONS = [
  {
    id: "charger-reports",
    path: "charger-reports",
    label: "adminChargerReports",
  },
  { id: "errors", path: "errors", label: "adminErrors" },
  {
    id: "performance",
    path: "performance",
    label: "adminPerformance",
  },
  { id: "reports", path: "reports", label: "adminReports" },
  { id: "suggestions", path: "suggestions", label: "adminSuggestions" },
  { id: "usage", path: "usage", label: "adminUsage" },
];

export { ADMIN_SECTIONS };
