// The data of a page rendered on the server: in production the Worker gives
// it to the page; in the tests it's passed in a header (src/lib/page-data.js).
// `props` is { data } or { failed: true }, or a function of the page's URL
// returning one.
const fakePageData = (page, path, props) =>
  page.route(path, (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      headers: {
        ...route.request().headers(),
        "x-ev-maps-page-data": JSON.stringify(typeof props === "function" ? props(url) : props),
      },
    });
  });

// The admin errors page, /{lang}/admin/errors/ with any query.
const ERRORS_PAGE = /\/admin\/errors\/(\?.*)?$/;

// The admin unavailable chargers page, /{lang}/admin/unavailability/.
const UNAVAILABILITY_PAGE = /\/admin\/unavailability\/(\?.*)?$/;

// The admin charger reports page, /{lang}/admin/charger-reports/ with any
// query.
const CHARGER_REPORTS_PAGE = /\/admin\/charger-reports\/(\?.*)?$/;

// The admin overview, /{lang}/admin/, with its dashboard.
const OVERVIEW_PAGE = /\/(en|pl|hu|es|de|fr|sk|cs)\/admin\/(\?.*)?$/;

// The admin charger suggestions page, /{lang}/admin/suggestions/ with any
// query.
const SUGGESTIONS_PAGE = /\/admin\/suggestions\/(\?.*)?$/;

// The admin usage page, /{lang}/admin/usage/ with any query.
const USAGE_PAGE = /\/admin\/usage\/(\?.*)?$/;

// The admin test reports page, /{lang}/admin/reports/ with any query (not
// a report's files, under it).
const REPORTS_PAGE = /\/admin\/reports\/(\?.*)?$/;

// The admin Usage section's preference pages, /{lang}/admin/usage/{section}/.
const PREFERENCES_PAGE = /\/admin\/usage\/(settings|filters|routes)\/$/;

// The admin performance page, /{lang}/admin/performance/ with any query.
const PERFORMANCE_PAGE = /\/admin\/performance\/(\?.*)?$/;

export {
  CHARGER_REPORTS_PAGE,
  ERRORS_PAGE,
  OVERVIEW_PAGE,
  PREFERENCES_PAGE,
  PERFORMANCE_PAGE,
  REPORTS_PAGE,
  SUGGESTIONS_PAGE,
  UNAVAILABILITY_PAGE,
  USAGE_PAGE,
  fakePageData,
};
