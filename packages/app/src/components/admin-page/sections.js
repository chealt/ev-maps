// The admin area's sections, for its navigation and overview: each is a page
// at /{lang}/admin/{path}/ with a label and a description from the
// translations. A new admin section adds its page and one line here.
const ADMIN_SECTIONS = [
  { id: "errors", path: "errors", label: "adminErrors", description: "adminErrorsDescription" },
  {
    id: "performance",
    path: "performance",
    label: "adminPerformance",
    description: "adminPerformanceDescription",
  },
  { id: "usage", path: "usage", label: "adminUsage", description: "adminUsageDescription" },
];

export { ADMIN_SECTIONS };
