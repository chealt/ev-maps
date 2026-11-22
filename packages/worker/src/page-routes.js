// The pages the Worker handles itself, by domain, before the static assets:
// the first matching one handles a request (src/index.js). A page route is
// { name, matches(request, url), handle({ request, env, context, url,
// signedInUser, renderAppPage }) }; renderAppPage renders the app's
// server-rendered pages (src/app-server.js).
//
// A new domain keeps its page routes in its own module and adds one line
// here; put specific paths before general ones.

import { pageRoutes as admin } from "./admin.js";
import { pageRoutes as languageRedirect } from "./language-redirect.js";
import { pageRoutes as testReports } from "./test-reports.js";

const PAGE_ROUTES = [
  // Before the admin pages: /{lang}/admin/reports/{id}/...
  ...testReports,
  // Last among the admin paths: /{lang}/admin*.
  ...admin,
  ...languageRedirect,
];

export { PAGE_ROUTES };
