// English: the admin area's errors page. See ../index.js for how
// the sections are put together and which pages get which.

const adminErrors = {
  page: {
    adminErrorColumn: "Error",
    adminSourceColumn: "Where",
    adminBrowserColumn: "Browser",
    adminOsColumn: "System",
    adminErrorFilters: "Filter the errors",
    adminFilterAll: "All",
    adminFilterSearch: "Search",
    adminFilterSort: "Sort by",
    adminSortLastSeen: "Last seen",
    adminSortFirstSeen: "First seen",
    adminSortCount: "Most often",
    adminFilterApply: "Apply",
    adminFilterClear: "Clear filters",
    adminCountColumn: "Times",
    adminUsersColumn: "Users",
    adminLastSeenColumn: "Last seen",
    adminFirstSeenColumn: "First seen",
    adminPages: "Pages",
    adminPreviousPage: "Previous",
    adminNextPage: "Next",
    adminAllErrors: "All errors",
    adminTimeLabel: "Time",
    adminUrlLabel: "URL",
    adminContextLabel: "Job",
    adminBrowserLabel: "Browser",
    adminUserLabel: "User",
    adminCountryLabel: "Country",
    adminStackTrace: "Stack trace",
    adminErrorsNotLoaded: "The errors couldn't be loaded. Try again.",
    adminNoErrors: "No errors in the last 30 days.",
    adminNone: "–",
    adminErrorGroups: {
      one: "{count} kind of error in the last 30 days",
      other: "{count} kinds of errors in the last 30 days",
    },
    adminOccurrences: {
      one: "Happened {count} time in the last 30 days",
      other: "Happened {count} times in the last 30 days",
    },
    // Where an error happened.
    adminErrorSources: {
      worker: "Server",
      page: "Browser",
    },
  },
};

export { adminErrors };
