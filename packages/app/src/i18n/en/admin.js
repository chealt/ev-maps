// English: the admin area's frame: navigation, overview. See ../index.js for how
// the sections are put together and which pages get which.

const admin = {
  page: {
    adminOverview: "Overview",
    adminErrors: "Errors",
    adminUsage: "Usage",
  },
  messages: {
    adminSignedInAs: "Signed in as {email}",
    adminSignedOut: "Sign in with an admin account to see this page.",
    // Shared by the admin pages with pages.
    adminPageOf: "Page {page} of {pages}",
    // A bar of a chart (components/bar-chart).
    adminDayCount: "{day}: {count}",
  },
};

export { admin };
