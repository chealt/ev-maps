// The app's server-rendered pages: Astro builds them into
// packages/app/dist/server (the Cloudflare adapter), and the Worker hands
// their requests to it. Pages read the data the Worker gives them from the
// context's props (src/admin.js). Kept apart so that tests of the other
// modules don't need the app's build.
// "ev-maps-app-server" is an alias for its entry (wrangler.toml).
import astro from "ev-maps-app-server";

const renderAppPage = (request, env, context) => astro.fetch(request, env, context);

export { renderAppPage };
