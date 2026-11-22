// Magyar: the admin area's frame: navigation, overview. See ../index.js for how
// the sections are put together and which pages get which.

const admin = {
  page: {
    adminOverview: "Áttekintés",
    adminSections: "Részek",
    adminErrorsDescription: "mi romlott el az oldalakon és a szerveren az elmúlt 30 napban",
    adminErrors: "Hibák",
    adminUsage: "Használat",
    adminUsageDescription: "hogyan használják az oldalt, naponta számolva",
  },
  messages: {
    adminSignedInAs: "Bejelentkezve: {email}",
    adminSignedOut: "Jelentkezz be adminisztrátori fiókkal az oldal megtekintéséhez.",
    // A bar of a chart (components/bar-chart).
    adminDayCount: "{day}: {count}",
  },
};

export { admin };
