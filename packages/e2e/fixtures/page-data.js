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

export { ERRORS_PAGE, UNAVAILABILITY_PAGE, fakePageData };
