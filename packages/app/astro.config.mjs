import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

// Lists the built files for the service worker to precache (public/sw.js).
// The HTML doesn't reference every file: scripts import shared chunks. Pages
// aren't listed: there's one per language and country, and the service worker
// caches the ones that are open.
const precacheManifest = () => ({
  name: "ev-maps:precache-manifest",
  hooks: {
    "astro:build:done": async ({ dir }) => {
      const files = await readdir(new URL("_astro/", dir));
      const urls = ["/favicon.svg", ...files.map((file) => `/_astro/${file}`)];
      await writeFile(new URL("precache-manifest.json", dir), JSON.stringify(urls));
    },
  },
});

export default defineConfig({
  output: "static",
  // Pages are static, except those with `prerender = false` (the admin errors
  // page): the adapter builds those into dist/server, which the Worker runs
  // (packages/worker/src/app-server.js); the static files go to dist/client.
  adapter: cloudflare(),
  // Production's main address, for absolute URLs such as the pages' hreflang
  // links. It also answers on ev-maps.chealt.workers.dev.
  site: "https://ev.chealt.com",
  devToolbar: {
    enabled: false,
  },
  integrations: [precacheManifest()],
  // Every page is under its language, e.g. /en/ and /pl/hu/; see
  // src/pages/index.astro for /. Each locale needs its copy in src/i18n.
  i18n: {
    locales: ["en", "pl", "hu", "es"],
    defaultLocale: "en",
    routing: { prefixDefaultLocale: true },
  },
  vite: {
    // Pages render in workerd in development (the Cloudflare adapter), where
    // process.env is empty: the build's settings are inlined instead.
    define: {
      "process.env.EV_MAPS_MAX_PAGE_CHARGERS": JSON.stringify(
        process.env.EV_MAPS_MAX_PAGE_CHARGERS ?? ""
      ),
      // No Worker runs (the tests): pages don't ask it for their data.
      "process.env.EV_MAPS_NO_API_PROXY": JSON.stringify(process.env.EV_MAPS_NO_API_PROXY ?? ""),
    },
    resolve: {
      alias: {
        // The exported chargers the country pages are built from (see
        // src/lib/pages.js); the tests point it at their own fixtures.
        "@country-chargers": resolve(process.env.EV_MAPS_CHARGERS_DIR ?? "data/chargers"),
      },
    },
    // The API runs in the Worker, which `bun run dev` starts on port 8787.
    // The tests fake the API and run no Worker (EV_MAPS_NO_API_PROXY): calls
    // they don't fake get a 404 instead of failing in the proxy.
    server: process.env.EV_MAPS_NO_API_PROXY ? {} : { proxy: { "/api": "http://localhost:8787" } },
  },
});
